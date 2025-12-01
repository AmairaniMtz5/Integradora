import os
import cv2
import argparse
import pandas as pd
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report
import joblib
from tqdm import tqdm


# Detectar clases en dataset/ (usar carpetas existentes)
if not os.path.exists('dataset'):
    print("Error: no existe la carpeta 'dataset/'")
    exit()

posturas = [d for d in os.listdir('dataset') if os.path.isdir(os.path.join('dataset', d))]
if not posturas:
    print("Error: no se encontraron subcarpetas en 'dataset/'")
    exit()

print(f"Clases detectadas en dataset/: {posturas}")

# Parse CLI args
parser = argparse.ArgumentParser(description='Entrenar modelo desde dataset (imagenes y videos)')
parser.add_argument('--videos-only', action='store_true', help='Procesar sólo archivos de video y omitir imágenes')
parser.add_argument('--fps', type=int, default=3, help='Frames por segundo a extraer de cada video (default: 3)')
args = parser.parse_args()

# Preparar MediaPipe PoseLandmarker
base_options = python.BaseOptions(model_asset_path='pose_landmarker.task')
options = vision.PoseLandmarkerOptions(
    base_options=base_options,
    min_pose_detection_confidence=0.5
)
detector = vision.PoseLandmarker.create_from_options(options)


def process_image_frame(frame):
    """Procesa un frame (BGR) y devuelve lista de landmarks [x,y,z,...] o None.
    Aplica normalización por escala de torso para robustez.
    """
    try:
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        imagen_mp = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)
        resultado = detector.detect(imagen_mp)
        if resultado.pose_landmarks:
            pts = [[lm.x, lm.y, lm.z] for lm in resultado.pose_landmarks[0]]
            # Normalización: escalar por tamaño de torso (hombros↔caderas)
            if len(pts) >= 25:
                LS, RS, LH, RH = 11, 12, 23, 24
                shoulder_center = ((pts[LS][0] + pts[RS][0]) / 2, (pts[LS][1] + pts[RS][1]) / 2)
                hip_center = ((pts[LH][0] + pts[RH][0]) / 2, (pts[LH][1] + pts[RH][1]) / 2)
                torso = ((shoulder_center[0] - hip_center[0]) ** 2 + (shoulder_center[1] - hip_center[1]) ** 2) ** 0.5
                scale = torso if torso > 1e-3 else 1.0
                # Centrar y escalar
                cx, cy = shoulder_center
                for i in range(len(pts)):
                    pts[i][0] = (pts[i][0] - cx) / scale
                    pts[i][1] = (pts[i][1] - cy) / scale
            landmarks = [coord for p in pts for coord in p]
            return landmarks
    except Exception:
        return None
    return None


def extract_frames_from_video(video_path, target_fps=1):
    """Extrae frames desde un video a target_fps (frames por segundo).
    Devuelve lista de frames (BGR).
    """
    frames = []
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return frames

    orig_fps = cap.get(cv2.CAP_PROP_FPS) or 30
    step = max(1, int(round(orig_fps / target_fps)))

    idx = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if idx % step == 0:
            frames.append(frame)
        idx += 1

    cap.release()
    return frames


# 1) Procesar dataset (imágenes y videos) y generar dataset_posturas.csv
print("\nProcesando dataset (imágenes y videos)...")
dataset = []
columnas = [f'lm_{i}_{coord}' for i in range(33) for coord in ['x', 'y', 'z']]

for postura in posturas:
    path = os.path.join('dataset', postura)
    archivos = [f for f in os.listdir(path) if f.lower().endswith(('.jpg', '.jpeg', '.png', '.mp4', '.avi', '.mov', '.mkv', '.webm'))]
    print(f"\nAnalizando: {postura} -> {len(archivos)} archivos")

    for nombre in tqdm(archivos, desc=postura):
        ruta = os.path.join(path, nombre)
        try:
            if not args.videos_only and nombre.lower().endswith(('.jpg', '.jpeg', '.png')):
                frame = cv2.imread(ruta)
                if frame is None:
                    continue
                landmarks = process_image_frame(frame)
                if landmarks:
                    dataset.append(landmarks + [postura])
                else:
                    print(f"WARN: No se detectó postura en imagen {ruta}")

            else:
                # Video: extraer frames y procesarlos
                frames = extract_frames_from_video(ruta, target_fps=args.fps)
                if not frames:
                    print(f"WARN: No se pudieron extraer frames de {ruta}")
                    continue
                for f in frames:
                    landmarks = process_image_frame(f)
                    if landmarks:
                        dataset.append(landmarks + [postura])

        except Exception as e:
            print(f"ERROR: Error procesando {ruta}: {str(e)}")


# Guardar o cargar dataset
if dataset:
    df = pd.DataFrame(dataset, columns=columnas + ['clase'])
    df.to_csv('dataset_posturas.csv', index=False)
    print(f"\nDataset generado con {len(df)} muestras validas")
else:
    print("\nERROR: No se pudo generar el dataset. Asegúrate de tener imágenes o videos procesables en dataset/")
    exit()


# 2) Entrenar modelo con el CSV generado
print("\nEntrenando modelo con el dataset generado...")
if len(df) < 50:
    print(f"Advertencia: Dataset muy pequeño ({len(df)} muestras). Se recomiendan al menos 50 por clase.")

encoder = LabelEncoder()
df['clase_num'] = encoder.fit_transform(df['clase'])

X = df.drop(['clase', 'clase_num'], axis=1)
y = df['clase_num']
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

modelo = RandomForestClassifier(n_estimators=400, max_depth=12, min_samples_leaf=2, random_state=42)
modelo.fit(X_train, y_train)

y_pred = modelo.predict(X_test)
print("\nReporte de clasificación:")
print(classification_report(y_test, y_pred, target_names=encoder.classes_))

joblib.dump(modelo, 'modelo_posturas.pkl')
joblib.dump(encoder, 'encoder.pkl')
print("\nModelo guardado como 'modelo_posturas.pkl'")