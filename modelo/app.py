# app.py
print("[BOOT] Iniciando importaciones...")
import sys
import os
# Suprimir warnings de TensorFlow
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'

from flask import Flask, render_template, jsonify, send_file, request
print("[BOOT] ✓ Flask importado")
from flask_socketio import SocketIO
print("[BOOT] ✓ Flask-SocketIO importado")
import cv2
print("[BOOT] ✓ OpenCV importado")
import mediapipe as mp
print("[BOOT] ✓ MediaPipe importado")
import numpy as np
import joblib
import base64
import json
import requests
from threading import Lock
from pathlib import Path
print("[BOOT] ✓ Todas las importaciones completadas")

app = Flask(__name__)
# Forzar modo threading para evitar dependencias async (aiohttp/asyncio) en Python 3.9
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# Cargar modelo y encoder con manejo de errores
try:
    print("[BOOT] Cargando modelo_posturas.pkl...")
    modelo = joblib.load('modelo_posturas.pkl')
    print("[BOOT] Cargando encoder.pkl...")
    encoder = joblib.load('encoder.pkl')
    print("[BOOT] ✓ Modelo y encoder cargados correctamente")
except FileNotFoundError as e:
    print(f"[BOOT][ERROR] No se encontró el archivo: {e.filename}")
    print("Asegúrate de que modelo_posturas.pkl y encoder.pkl están en la carpeta 'modelo'")
    exit(1)
except Exception as e:
    print(f"[BOOT][ERROR] Error al cargar modelo: {e}")
    import traceback
    traceback.print_exc()
    exit(1)


mp_pose = mp.solutions.pose
pose = mp_pose.Pose(
    min_detection_confidence=0.4,  # Reducido para detectar más movimientos
    min_tracking_confidence=0.4     # Reducido para mejor seguimiento
)


thread_lock = Lock()
thread = None
current_reference_landmarks = None  # Landmarks de la imagen de referencia (single)
current_reference_sequence = []    # Lista de landmarks por frame del video de referencia
reference_fps = 1                  # FPS de la secuencia de referencia (frames por segundo)
current_reference_index = 0        # Índice de frame de referencia sincronizado desde cliente
user_landmarks_buffer = []         # Buffer corto de landmarks del usuario para suavizar ruido
current_tolerance = 1.0            # Factor de tolerancia: >1 más permisivo, <1 más estricto
recent_user_landmarks_buffer = []  # Buffer corto usado por el endpoint HTTP evaluate_frame

# Integración opcional con Groq para decisión final basada en métricas
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

def groq_assess_movement(metrics: dict, default_feedback: str, default_reason: str):
    """Consulta Groq si hay API key para obtener 'Bien/Mal' con explicación breve.
    Retorna (feedback, reason). Si falla, retorna los valores por defecto.
    """
    if not GROQ_API_KEY:
        return default_feedback, default_reason
    try:
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}
        system_prompt = (
            "Eres un verificador de movimiento para ejercicios de fisioterapia. "
            "Decide 'Bien' o 'Mal' usando métricas numéricas. "
            "Responde SOLO en JSON: {\"is_good\": bool, \"reason\": string}."
        )
        body = {
            "model": "llama-3.1-8b-instant",
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps({"metrics": metrics}, ensure_ascii=False)}
            ]
        }
        resp = requests.post(url, headers=headers, json=body, timeout=8)
        if resp.status_code != 200:
            return default_feedback, default_reason
        data = resp.json()
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "{}")
        parsed = json.loads(content)
        is_good = bool(parsed.get("is_good", False))
        reason = str(parsed.get("reason", default_reason))
        return ("Bien" if is_good else "Mal"), reason
    except Exception:
        return default_feedback, default_reason

# Nota: Ahora se asume que el modelo devuelve directamente la etiqueta
# correspondiente a la condición médica (p. ej. 'lumbalgia mecanica inespecifica',
# 'hernia de disco lumbar', 'espondilolisis', 'escoliosis lumbar', etc.).


def evaluate_posture(landmarks, posture_label, reference_landmarks=None, tolerance_scale=1.0):
    """Evaluación mejorada que devuelve 'Bien' o 'Mal' y una breve sugerencia.
    
    Utiliza umbrales CALIBRADOS basados en análisis de videos reales.
    Si se proporciona reference_landmarks, se compara con precisión basada en distancias de landmarks.
    Si no, usa heurísticas especializadas por enfermedad.
    """
    if not landmarks or not posture_label:
        return 'Sin evaluación', 'No hay datos suficientes', {'avg_distance': None, 'max_distance': None}

    # Exponer el buffer global localmente para permitir comparaciones temporales
    global recent_user_landmarks_buffer, current_reference_index

    # Convertir la lista plana a pares (x,y,z) por punto
    pts = [(landmarks[i], landmarks[i+1], landmarks[i+2]) for i in range(0, len(landmarks), 3)]

    # Helpers: normalizar y alineamiento por similitud (Umeyama) para robustez
    def to_xy_array(pts_list):
        arr = np.array(pts_list)
        if arr.ndim == 2 and arr.shape[1] >= 2:
            return arr[:, :2]
        # si está plano [x,y,z,...], convertir
        if arr.ndim == 1:
            arr = arr.reshape((-1, 3))
            return arr[:, :2]
        return arr

    def normalize_by_pelvis(pts_list):
        try:
            arr = np.array(pts_list)
            LEFT_HIP_IDX = 23
            RIGHT_HIP_IDX = 24
            LEFT_SHOULDER_IDX = 11
            RIGHT_SHOULDER_IDX = 12
            if arr.shape[0] > max(LEFT_HIP_IDX, RIGHT_HIP_IDX, LEFT_SHOULDER_IDX, RIGHT_SHOULDER_IDX):
                hip_center = (arr[LEFT_HIP_IDX] + arr[RIGHT_HIP_IDX]) / 2.0
                shoulder_center = (arr[LEFT_SHOULDER_IDX] + arr[RIGHT_SHOULDER_IDX]) / 2.0
            else:
                hip_center = np.mean(arr, axis=0)
                shoulder_center = hip_center
            translated = arr - hip_center
            torso_len = np.linalg.norm(shoulder_center - hip_center)
            if torso_len <= 1e-6:
                torso_len = 1.0
            normalized = translated / torso_len
            return normalized
        except Exception:
            return np.array(pts_list)

    def umeyama_similarity(src, dst, eps=1e-8):
        """Estimate similarity transform (s,R,t) that maps src -> dst using Umeyama method (2D).
        Devuelve (s, R, t) donde R es 2x2, t es 2-vector."""
        src = np.array(src, dtype=float)
        dst = np.array(dst, dtype=float)
        if src.shape != dst.shape or src.ndim != 2 or src.shape[1] != 2:
            raise ValueError('src/dst must be Nx2 arrays')

        n = src.shape[0]
        mu_src = src.mean(axis=0)
        mu_dst = dst.mean(axis=0)
        src_c = src - mu_src
        dst_c = dst - mu_dst

        var_src = (src_c**2).sum() / n
        cov = (dst_c.T @ src_c) / n

        U, D, Vt = np.linalg.svd(cov)
        S = np.eye(2)
        if np.linalg.det(U) * np.linalg.det(Vt) < 0:
            S[-1, -1] = -1
        R = U @ S @ Vt
        scale = 1.0
        if var_src > eps:
            scale = np.trace(D @ S) / var_src if D.ndim == 1 else np.trace(np.diag(D) @ S) / var_src
        t = mu_dst - scale * (R @ mu_src)
        return scale, R, t

    def align_and_compute_distances(user_pts, ref_pts):
        # user_pts and ref_pts are lists/arrays of (x,y,...) - usar solo XY
        u_xy = to_xy_array(user_pts)
        r_xy = to_xy_array(ref_pts)
        if u_xy.shape[0] != r_xy.shape[0]:
            # si longitud diferente, truncar al mínimo
            m = min(u_xy.shape[0], r_xy.shape[0])
            u_xy = u_xy[:m]
            r_xy = r_xy[:m]
        try:
            s, R, t = umeyama_similarity(u_xy, r_xy)
            u_aligned = (s * (R @ u_xy.T)).T + t
        except Exception:
            # fallback: centrar y escalar por torso
            u_norm = normalize_by_pelvis(user_pts)
            r_norm = normalize_by_pelvis(ref_pts)
            u_aligned = to_xy_array(u_norm)
            r_xy = to_xy_array(r_norm)

        # distancias euclidianas entre u_aligned y r_xy
        diffs = u_aligned - r_xy
        dists = np.linalg.norm(diffs, axis=1)
        return dists

    # DTW helper: compara dos secuencias de frames usando la distancia por frame
    def dtw_distance(seq_a, seq_b, frame_distance_fn):
        """Computa la distancia DTW entre dos secuencias donde frame_distance_fn(a,b) devuelve un escalar.
        Devuelve (avg_distance, max_distance, path_len, total_cost).
        """
        a = list(seq_a)
        b = list(seq_b)
        na = len(a)
        nb = len(b)
        if na == 0 or nb == 0:
            return None, None, 0, float('inf')

        # construir matriz DTW
        dtw = np.full((na+1, nb+1), np.inf)
        dtw[0,0] = 0.0

        # precomputar distancias entre frames
        fd = np.zeros((na, nb), dtype=float)
        for i in range(na):
            for j in range(nb):
                try:
                    fd[i,j] = float(frame_distance_fn(a[i], b[j]))
                except Exception:
                    fd[i,j] = float('inf')

        for i in range(1, na+1):
            for j in range(1, nb+1):
                cost = fd[i-1, j-1]
                dtw[i,j] = cost + min(dtw[i-1,j], dtw[i,j-1], dtw[i-1,j-1])

        # reconstruir la ruta (camino) para obtener longitudes/costes por paso
        i = na
        j = nb
        path = []
        while i > 0 and j > 0:
            path.append((i-1,j-1))
            choices = [(dtw[i-1,j-1], i-1, j-1), (dtw[i-1,j], i-1, j), (dtw[i,j-1], i, j-1)]
            best = min(choices, key=lambda x: x[0])
            i,j = best[1], best[2]
        path.reverse()

        if not path:
            return None, None, 0, float('inf')

        costs = [fd[p] for p in path]
        avg = float(np.mean(costs))
        mx = float(np.max(costs))
        total_cost = float(dtw[na, nb])
        return avg, mx, len(path), total_cost

    # Índices comunes en MediaPipe Pose
    LEFT_SHOULDER = 11
    RIGHT_SHOULDER = 12
    LEFT_HIP = 23
    RIGHT_HIP = 24
    LEFT_KNEE = 25
    RIGHT_KNEE = 26
    NOSE = 0
    NECK = 1

    feedback = 'Bien'
    reason = 'Postura dentro de parámetros esperados'

    try:
        ls = pts[LEFT_SHOULDER]
        rs = pts[RIGHT_SHOULDER]
        lh = pts[LEFT_HIP]
        rh = pts[RIGHT_HIP]
        nose = pts[NOSE]

        # Normalizar puntos para heurísticas cuando no haya referencia
        try:
            norm_all = normalize_by_pelvis(pts)
        except Exception:
            norm_all = pts
        nls = norm_all[LEFT_SHOULDER]
        nrs = norm_all[RIGHT_SHOULDER]
        nlh = norm_all[LEFT_HIP]
        nrh = norm_all[RIGHT_HIP]
        
        # Si hay landmarks de referencia, calcular similitud con umbrales CALIBRADOS
        avg_distance = None
        max_distance = None
        # Diferenciar entre referencia como UN frame (lista plana) o como SECUENCIA de frames
        if reference_landmarks:
            # Secuencia de frames (lista-de-listas)
            if isinstance(reference_landmarks, list) and len(reference_landmarks) > 0 and isinstance(reference_landmarks[0], list):
                ref_seq = reference_landmarks
                # Obtener ventana de referencia centrada en current_reference_index si es posible
                try:
                    global current_reference_index
                    idx = int(current_reference_index) if isinstance(current_reference_index, int) else 0
                except Exception:
                    idx = 0

                # Obtener la secuencia de usuario (preferir buffer suavizado si existe)
                try:
                    user_seq = list(recent_user_landmarks_buffer) if recent_user_landmarks_buffer else [landmarks]
                except Exception:
                    user_seq = [landmarks]

                # Ventana en referencia: ancho relativo a usuario (ej. 3x longitud de usuario, mínimo 4)
                m = max(1, len(user_seq))
                win = min(len(ref_seq), max(4, 3 * m))
                start = max(0, idx - win // 2)
                end = min(len(ref_seq), start + win)
                ref_window = ref_seq[start:end]

                # función que calcula distancia entre dos frames (media de distancias entre puntos tras alinear)
                def frame_dist(a_frame, b_frame):
                    try:
                        d = align_and_compute_distances(a_frame, b_frame)
                        if len(d) == 0:
                            return float('inf')
                        return float(np.mean(d))
                    except Exception:
                        return float('inf')

                avg_distance, max_distance, path_len, total_cost = dtw_distance(user_seq, ref_window, frame_dist)

                # Umbrales término medio: balance entre sensibilidad y precisión
                t = float(tolerance_scale)
                good_avg_thresh = 0.20 * t
                good_max_thresh = 0.42 * t
                ok_avg_thresh = 0.30 * t
                ok_max_thresh = 0.55 * t

                if avg_distance is not None:
                    if avg_distance < good_avg_thresh and max_distance < good_max_thresh:
                        feedback = 'Bien'
                        reason = '✓ Movimiento detectado correctamente'
                    elif avg_distance < ok_avg_thresh and max_distance < ok_max_thresh:
                        feedback = 'Bien'
                        reason = '✓ Buen movimiento'
                    else:
                        feedback = 'Mal'
                        reason = '✗ Ajusta tu posición para que coincida mejor'
                else:
                    feedback = 'Sin evaluación'
                    reason = 'No se pudo comparar con la referencia (DTW)'
            # Caso referencia como un único frame (lista plana)
            elif isinstance(reference_landmarks, list) and len(reference_landmarks) >= 10:
                ref_pts = [(reference_landmarks[i], reference_landmarks[i+1], reference_landmarks[i+2]) 
                           for i in range(0, len(reference_landmarks), 3)]

                # Intentar suavizar landmarks del usuario si están en buffer (reduce ruido)
                try:
                    # usar buffer global si existe (para llamadas HTTP rápidas)
                    if recent_user_landmarks_buffer:
                        # promediar elemento a elemento
                        arr = np.array(recent_user_landmarks_buffer)
                        avg_land = list(np.mean(arr, axis=0))
                        user_pts = [(avg_land[i], avg_land[i+1], avg_land[i+2]) for i in range(0, len(avg_land), 3)]
                    else:
                        user_pts = pts
                except Exception:
                    user_pts = pts

                # Calcular distancias tras alinear por similitud (Umeyama)
                try:
                    dists = align_and_compute_distances(user_pts, ref_pts)
                    avg_distance = float(np.mean(dists))
                    max_distance = float(np.max(dists))
                except Exception:
                    # fallback a comparación simple normalizada
                    norm_user = normalize_by_pelvis(user_pts)
                    norm_ref = normalize_by_pelvis(ref_pts)
                    d = []
                    for i in range(min(len(norm_user), len(norm_ref))):
                        p = norm_user[i]
                        rp = norm_ref[i]
                        dist = np.linalg.norm(p[:2] - rp[:2])
                        d.append(dist)
                    if d:
                        avg_distance = float(np.mean(d))
                        max_distance = float(np.max(d))
                    else:
                        avg_distance = None
                        max_distance = None

                # Umbrales término medio para postura por frame
                t = float(tolerance_scale)
                good_avg_thresh = 0.17 * t
                good_max_thresh = 0.38 * t
                ok_avg_thresh = 0.28 * t
                ok_max_thresh = 0.52 * t

                if avg_distance is not None:
                    if avg_distance < good_avg_thresh and max_distance < good_max_thresh:
                        feedback = 'Bien'
                        reason = '✓ Postura correcta'
                    elif avg_distance < ok_avg_thresh and max_distance < ok_max_thresh:
                        feedback = 'Bien'
                        reason = '✓ Bien hecho'
                    else:
                        feedback = 'Mal'
                        reason = '✗ Ajusta tu posición'
                else:
                    feedback = 'Sin evaluación'
                    reason = 'No se pudo comparar con la referencia'
        else:
            # Heurísticas especializadas si no hay referencia
            # Usar puntos normalizados para invariancia a escala/traslación
            shoulder_avg_y = (nls[1] + nrs[1]) / 2
            hip_avg_y = (nlh[1] + nrh[1]) / 2
            shoulder_avg_x = (nls[0] + nrs[0]) / 2
            hip_avg_x = (nlh[0] + nrh[0]) / 2

            trunk_tilt_y = abs(hip_avg_y - shoulder_avg_y)
            trunk_tilt_x = abs(hip_avg_x - shoulder_avg_x)

            shoulder_diff = abs(nls[1] - nrs[1])
            hip_diff = abs(nlh[1] - nrh[1])

            # Heurísticas muy permisivas - cualquier detección de postura es positiva
            if posture_label == 'espondilolisis':
                if trunk_tilt_y > 0.02 or trunk_tilt_x > 0.03:
                    feedback = 'Bien'
                    reason = '✓ Postura detectada correctamente'
                else:
                    feedback = 'Bien'  # Más permisivo
                    reason = '✓ Postura en proceso'
            
            elif posture_label == 'lumbalgia mecánica inespecífica':
                if abs(trunk_tilt_y) < 0.08 and abs(trunk_tilt_x) < 0.07:
                    feedback = 'Bien'
                    reason = '✓ Buena alineación'
                else:
                    feedback = 'Bien'  # Más permisivo
                    reason = '✓ Postura detectada'
            
            elif posture_label == 'escoliosis lumbar':
                if shoulder_diff < 0.04 and hip_diff < 0.04:
                    feedback = 'Bien'
                    reason = '✓ Buena postura'
                else:
                    feedback = 'Bien'  # Más permisivo
                    reason = '✓ Postura detectada'
            
            elif posture_label == 'hernia de disco lumbar':
                if trunk_tilt_y < 0.12 and abs(trunk_tilt_x) < 0.10:
                    feedback = 'Bien'
                    reason = '✓ Postura correcta'
                else:
                    feedback = 'Bien'  # Más permisivo
                    reason = '✓ Postura en progreso'
    
    except Exception as e:
        return 'Sin evaluación', f'Error al calcular landmarks: {str(e)}', {'avg_distance': None, 'max_distance': None}

    return feedback, reason, {'avg_distance': float(avg_distance) if avg_distance is not None else None,
                              'max_distance': float(max_distance) if max_distance is not None else None}

def classify_posture(frame):
    image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = pose.process(image)

    if results.pose_landmarks:
        # Extraer landmarks en forma plana [x,y,z,...] - siempre usar todos
        # (filtrado de visibilidad era demasiado agresivo y rechazaba frames válidos)
        landmarks = [coord for landmark in results.pose_landmarks.landmark
                     for coord in [landmark.x, landmark.y, landmark.z]]

        # Predecir postura
        try:
            posture = encoder.inverse_transform(modelo.predict([landmarks]))[0]
        except Exception:
            posture = None

        # Dibujar landmarks en el frame
        mp.solutions.drawing_utils.draw_landmarks(
            frame, results.pose_landmarks, mp_pose.POSE_CONNECTIONS)

        return frame, posture, landmarks

    return frame, None, None

def video_stream():
    global current_reference_landmarks
    global current_reference_sequence, current_reference_index, user_landmarks_buffer
    cap = cv2.VideoCapture(0)
    while True:
        ret, frame = cap.read()
        if not ret:
            break
            
        frame, posture, landmarks = classify_posture(frame)

        # Tratar la etiqueta del modelo como la condición médica
        condition = posture if posture else 'No detectada'

        # Suavizar landmarks del usuario (promedio último par de frames) para reducir ruido
        if landmarks:
            user_landmarks_buffer.append(landmarks)
            # mantener buffer corto
            if len(user_landmarks_buffer) > 3:
                user_landmarks_buffer.pop(0)
            # promediar elemento a elemento
            avg_landmarks = None
            try:
                arr = np.array(user_landmarks_buffer)
                avg_landmarks = list(np.mean(arr, axis=0))
            except Exception:
                avg_landmarks = landmarks
        else:
            avg_landmarks = None

        # Seleccionar landmarks de referencia sincronizados si existe una secuencia
        ref_landmarks_to_use = None
        if current_reference_sequence:
            idx = min(max(0, current_reference_index), len(current_reference_sequence)-1)
            ref_landmarks_to_use = current_reference_sequence[idx]
        elif current_reference_landmarks:
            ref_landmarks_to_use = current_reference_landmarks

        # Evaluar feedback (Bien/Mal + razón) usando landmarks de referencia sincronizados si están disponibles
        # Si tenemos una secuencia de referencia y un buffer del usuario (streaming), privilegimos comparación temporal (DTW)
        if current_reference_sequence and len(user_landmarks_buffer) > 1:
            try:
                # sincronizar el buffer corto del stream en el buffer global usado por evaluate_posture
                global recent_user_landmarks_buffer
                recent_user_landmarks_buffer = list(user_landmarks_buffer)
            except Exception:
                pass
            feedback_label, feedback_reason, metrics = evaluate_posture(avg_landmarks, posture, current_reference_sequence, tolerance_scale=current_tolerance)
        else:
            feedback_label, feedback_reason, metrics = evaluate_posture(avg_landmarks, posture, ref_landmarks_to_use, tolerance_scale=current_tolerance)

        _, buffer = cv2.imencode('.jpg', frame)
        frame_base64 = base64.b64encode(buffer).decode('utf-8')

        with thread_lock:
            socketio.emit('video_feed', {
                'image': f"data:image/jpeg;base64,{frame_base64}",
                'posture': posture or "No detectado",
                'condition': condition,
                'feedback': feedback_label,
                'reason': feedback_reason,
                'metrics': metrics
            })
    
    cap.release()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/datasets')
def get_datasets():
    """Retorna la lista de datasets disponibles (carpetas en 'dataset/')"""
    dataset_dir = Path('dataset')
    if not dataset_dir.exists():
        return jsonify([])
    
    datasets = [d.name for d in dataset_dir.iterdir() if d.is_dir()]
    return jsonify(sorted(datasets))

@app.route('/api/images/<dataset>')
def get_images(dataset):
    """Retorna la lista de videos disponibles en un dataset"""
    dataset_path = Path('dataset') / dataset
    if not dataset_path.exists():
        return jsonify([])
    
    # Extensiones de video soportadas
    video_extensions = {'.mp4', '.avi', '.mov', '.mkv', '.webm'}
    videos = [f.name for f in dataset_path.iterdir() 
              if f.is_file() and f.suffix.lower() in video_extensions]
    return jsonify(sorted(videos))

@app.route('/api/video/<dataset>/<video>')
def get_video(dataset, video):
    """Sirve un video específico del dataset"""
    video_path = Path('dataset') / dataset / video
    
    # Validar que el archivo existe y tiene extensión válida
    video_extensions = {'.mp4', '.avi', '.mov', '.mkv', '.webm'}
    if not video_path.exists() or video_path.suffix.lower() not in video_extensions:
        return jsonify({'error': 'Video no encontrado'}), 404
    
    return send_file(video_path, mimetype='video/mp4')

@socketio.on('set_reference_video')
def handle_set_reference_video(data):
    """Recibe la ruta del video de referencia, extrae una secuencia de landmarks muestreada
    y la guarda en `current_reference_sequence`. Se expone `reference_fps` para sincronización.
    Parámetros esperados en `data`: 'video_path' y opcional 'target_fps' (por defecto 2).
    """
    global current_reference_landmarks, current_reference_sequence, reference_fps, current_reference_index

    video_path = data.get('video_path')
    if not video_path:
        return

    full_path = Path(video_path)
    if not full_path.exists():
        socketio.emit('reference_video_set', {'success': False, 'message': 'Video no encontrado'})
        return

    try:
        # Abrir el video
        cap = cv2.VideoCapture(str(full_path))
        if not cap.isOpened():
            socketio.emit('reference_video_set', {'success': False, 'message': 'No se pudo abrir el video'})
            return

        # Configurar muestreo - extraer más frames para mejor detección
        video_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        target_fps = float(data.get('target_fps', 3))  # Aumentado de 2 a 3 fps
        reference_fps = max(1, int(target_fps))
        step = max(1, int(round(video_fps / target_fps)))

        seq = []
        frame_idx = 0
        max_samples = 600  # Duplicado de 300 a 600
        samples = 0
        skipped = 0  # Contador de frames sin detección

        print(f"Procesando video de referencia: {video_path}")
        print(f"Video FPS: {video_fps}, Target FPS: {target_fps}, Step: {step}")
        
        # Usar confianza más baja para detectar más poses
        local_pose = mp.solutions.pose.Pose(static_image_mode=True, model_complexity=1,
                                            min_detection_confidence=0.4)  # Reducido de 0.6 a 0.4
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            if frame_idx % step == 0:
                # Procesar con MediaPipe
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results = local_pose.process(frame_rgb)
                if results.pose_landmarks:
                    landmarks = [coord for landmark in results.pose_landmarks.landmark
                                 for coord in [landmark.x, landmark.y, landmark.z]]
                    seq.append(landmarks)
                    samples += 1
                    if samples >= max_samples:
                        print(f"Límite de {max_samples} muestras alcanzado")
                        break
                else:
                    skipped += 1
            
            frame_idx += 1
        
        print(f"Extracción completa - Frames procesados: {frame_idx}, Detecciones: {samples}, Sin detección: {skipped}")

        cap.release()
        try:
            local_pose.close()
        except Exception:
            pass

        if not seq:
            socketio.emit('reference_video_set', {'success': False, 'message': 'No se detectaron landmarks en el video'})
            return

        # Guardar secuencia y primera referencia
        current_reference_sequence = seq
        current_reference_landmarks = seq[0]
        current_reference_index = 0

        socketio.emit('reference_video_set', {
            'success': True,
            'frames': len(seq),
            'ref_fps': reference_fps,
            'message': f'Se extrajeron {len(seq)} frames de referencia (muestreo {reference_fps} fps)'
        })

    except Exception as e:
        socketio.emit('reference_video_set', {'success': False, 'message': str(e)})


@socketio.on('sync_reference_time')
def handle_sync_reference_time(data):
    """Recibe {'current_time': seconds} del cliente para sincronizar el índice de referencia."""
    global current_reference_index, reference_fps
    try:
        t = float(data.get('current_time', 0))
        idx = int(round(t * reference_fps))
        current_reference_index = max(0, idx)
    except Exception:
        pass


@socketio.on('set_tolerance')
def handle_set_tolerance(data):
    """Recibe {'tolerance': float} para ajustar la tolerancia de comparación en tiempo real."""
    global current_tolerance
    try:
        t = float(data.get('tolerance', 1.0))
        # limitar rango razonable
        if t <= 0:
            return
        current_tolerance = max(0.3, min(3.0, t))
        socketio.emit('tolerance_updated', {'tolerance': current_tolerance})
    except Exception:
        pass

@socketio.on('connect')
def handle_connect():
    global thread
    with thread_lock:
        if thread is None:
            thread = socketio.start_background_task(video_stream)


@app.after_request
def after_request(response):
    """Agregar headers CORS a todas las respuestas"""
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

@app.route('/api/evaluate_frame', methods=['POST', 'OPTIONS'])
def evaluate_frame():
    """Endpoint para evaluar una imagen enviada por la app móvil.
    Espera JSON: {'image': 'data:image/jpeg;base64,...'}
    Devuelve: posture, feedback, reason, metrics
    """
    if request.method == 'OPTIONS':
        return jsonify({'success': True}), 200
    
    try:
        payload = request.get_json()
        if not payload:
            return jsonify({'success': False, 'message': 'No JSON payload'}), 400

        img_b64 = payload.get('image')
        if not img_b64:
            return jsonify({'success': False, 'message': 'No image provided'}), 400

        # Soporta data URI o solo base64
        if ',' in img_b64:
            img_b64 = img_b64.split(',', 1)[1]

        img_bytes = base64.b64decode(img_b64)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None:
            return jsonify({'success': False, 'message': 'Invalid image data'}), 400

        # Usar las funciones existentes para clasificar y evaluar
        frame_proc, posture, landmarks = classify_posture(frame)

        # Actualizar buffer corto de landmarks para suavizar ruido en llamadas HTTP
        try:
            global recent_user_landmarks_buffer
            if landmarks:
                recent_user_landmarks_buffer.append(landmarks)
                if len(recent_user_landmarks_buffer) > 3:
                    recent_user_landmarks_buffer.pop(0)
        except Exception:
            pass

        # ⭐ Procesar frame del video de referencia si se proporciona información
        ref_landmarks_to_use = None
        reference_video_info = payload.get('reference_video')
        
        # Primero intentar usar la secuencia sincronizada (más eficiente)
        if current_reference_sequence:
            idx = min(max(0, current_reference_index), len(current_reference_sequence)-1)
            # Si tenemos un buffer de usuario reciente, preferimos comparar temporales (secuencia completa)
            try:
                if recent_user_landmarks_buffer and len(recent_user_landmarks_buffer) > 1:
                    ref_landmarks_to_use = current_reference_sequence
                else:
                    ref_landmarks_to_use = current_reference_sequence[idx]
            except Exception:
                ref_landmarks_to_use = current_reference_sequence[idx]
        elif current_reference_landmarks:
            ref_landmarks_to_use = current_reference_landmarks
        # Si no hay secuencia, intentar procesar el video en tiempo real
        elif reference_video_info and reference_video_info.get('condition') and reference_video_info.get('video_name'):
            # Intentar obtener el frame del video de referencia
            condition = reference_video_info.get('condition')
            video_name = reference_video_info.get('video_name')
            current_time = float(reference_video_info.get('current_time', 0))
            
            # Buscar el video en el servidor
            video_path = Path('dataset') / condition / video_name
            
            if video_path.exists():
                try:
                    # Abrir el video y obtener el frame en el tiempo especificado
                    cap = cv2.VideoCapture(str(video_path))
                    if cap.isOpened():
                        # Calcular frame número basado en el tiempo
                        video_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
                        frame_number = int(current_time * video_fps)
                        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
                        
                        ret, ref_frame = cap.read()
                        if ret:
                            # Procesar frame de referencia con MediaPipe
                            ref_frame_rgb = cv2.cvtColor(ref_frame, cv2.COLOR_BGR2RGB)
                            ref_results = pose.process(ref_frame_rgb)
                            if ref_results.pose_landmarks:
                                ref_landmarks_to_use = [coord for landmark in ref_results.pose_landmarks.landmark
                                                       for coord in [landmark.x, landmark.y, landmark.z]]
                        
                        cap.release()
                except Exception as e:
                    print(f"Error procesando frame de referencia: {e}")

        # ⭐ Evaluar postura - manejar caso cuando no hay landmarks del usuario
        if not landmarks:
            feedback_label = 'Sin evaluación'
            feedback_reason = 'No se detectó postura. Asegúrate de estar visible en la cámara.'
            metrics = {'avg_distance': None, 'max_distance': None}
        elif not posture:
            feedback_label = 'Sin evaluación'
            feedback_reason = 'Postura no reconocida. Intenta ajustar tu posición.'
            metrics = {'avg_distance': None, 'max_distance': None}
        else:
            # Log para debugging
            if ref_landmarks_to_use:
                print(f"Evaluando con referencia: posture={posture}, ref_available=True")
            else:
                print(f"Evaluando sin referencia: posture={posture}, usando heurísticas")
            
            feedback_label, feedback_reason, metrics = evaluate_posture(landmarks, posture, ref_landmarks_to_use, tolerance_scale=current_tolerance)

        # ⭐ Calcular tamaño de la pose para detectar distancia y visibilidad de cuerpo inferior
        pose_size = None
        distance_status = None  # 'too_close', 'too_far', 'optimal'
        visible_lower_body = False
        if landmarks:
            pts = [(landmarks[i], landmarks[i+1], landmarks[i+2]) for i in range(0, len(landmarks), 3)]
            if len(pts) >= 29:  # Asegurar que tenemos suficientes landmarks
                LEFT_SHOULDER = 11
                RIGHT_SHOULDER = 12
                LEFT_HIP = 23
                RIGHT_HIP = 24
                LEFT_KNEE = 25
                RIGHT_KNEE = 26
                LEFT_ANKLE = 27
                RIGHT_ANKLE = 28

                # Calcular distancia promedio entre hombros y caderas (torso)
                shoulder_center = ((pts[LEFT_SHOULDER][0] + pts[RIGHT_SHOULDER][0]) / 2,
                                   (pts[LEFT_SHOULDER][1] + pts[RIGHT_SHOULDER][1]) / 2)
                hip_center = ((pts[LEFT_HIP][0] + pts[RIGHT_HIP][0]) / 2,
                              (pts[LEFT_HIP][1] + pts[RIGHT_HIP][1]) / 2)

                # Distancia del torso (normalizada 0-1)
                torso_distance = np.sqrt((shoulder_center[0] - hip_center[0])**2 +
                                         (shoulder_center[1] - hip_center[1])**2)
                pose_size = float(torso_distance)

                # Heurística de visibilidad de cuerpo inferior: validar x,y en [0,1] y span vertical suficiente
                lower_idxs = [LEFT_HIP, RIGHT_HIP, LEFT_KNEE, RIGHT_KNEE, LEFT_ANKLE, RIGHT_ANKLE]
                def in_bounds(p):
                    return p is not None and 0.0 <= p[0] <= 1.0 and 0.0 <= p[1] <= 1.0
                lower_points = [pts[i] if i < len(pts) else None for i in lower_idxs]
                lower_in_bounds = all(in_bounds(p) for p in lower_points if p is not None)

                # Span vertical entre caderas y tobillos promedio
                ankles_y = [pts[LEFT_ANKLE][1], pts[RIGHT_ANKLE][1]] if in_bounds(pts[LEFT_ANKLE]) and in_bounds(pts[RIGHT_ANKLE]) else []
                vertical_span = None
                if lower_in_bounds and ankles_y:
                    avg_ankle_y = float(sum(ankles_y) / len(ankles_y))
                    vertical_span = avg_ankle_y - hip_center[1]
                    # Umbral muy relajado: 0.05 para aceptar la mayoría de encuadres
                    visible_lower_body = vertical_span > 0.05
                else:
                    visible_lower_body = False

                # Determinar estado de distancia (término medio):
                # Óptimo solo si hay algo de cuerpo inferior visible o span vertical >= 0.04
                if torso_distance > 0.35:
                    distance_status = 'too_close'
                elif torso_distance < 0.12:
                    distance_status = 'too_far'
                else:
                    # Dentro del rango, verificar visibilidad de piernas
                    if visible_lower_body or (vertical_span is not None and vertical_span >= 0.04):
                        distance_status = 'optimal'
                    else:
                        # Sin piernas visibles: no afirmar 'optimal'
                        distance_status = 'too_far'

        # Mapear a etiqueta amigable para cliente
        distance_quality = None
        if distance_status == 'too_close':
            distance_quality = 'near'
        elif distance_status == 'too_far':
            distance_quality = 'far'
        elif distance_status == 'optimal':
            # Marcar óptima si la distancia es buena, independiente de visibilidad completa
            distance_quality = 'optimal'
        else:
            distance_quality = 'far'

        # Añadir is_good y una estimación simple de confianza basada en avg_distance
        is_good = False
        confidence = None
        try:
            if isinstance(metrics.get('avg_distance'), float) and metrics.get('avg_distance') is not None:
                avg = float(metrics.get('avg_distance'))
                # confianza: 1 - saturación del avg (valores empíricos)
                confidence = max(0.0, min(1.0, 1.0 - (avg / (avg + 0.1))))
            if isinstance(feedback_label, str):
                low = feedback_label.lower()
                if 'bien' in low or '✓' in feedback_label:
                    is_good = True
        except Exception:
            pass

        # Inyectar visibilidad de cuerpo inferior en métricas
        try:
            if isinstance(metrics, dict):
                metrics['visible_lower_body'] = visible_lower_body
                metrics['lower_body_span'] = vertical_span if vertical_span is not None else None
                metrics['torso_distance'] = pose_size
        except Exception:
            pass

        # Integración opcional: ajustar feedback con Groq si hay API key
        try:
            metrics_payload = {
                'avg_distance': metrics.get('avg_distance'),
                'max_distance': metrics.get('max_distance'),
                'distance_quality': distance_quality,
                'visible_lower_body': visible_lower_body,
                'pose_size': pose_size,
            }
            new_feedback, new_reason = groq_assess_movement(metrics_payload, feedback_label, feedback_reason)
            feedback_label, feedback_reason = new_feedback, new_reason
            is_good = (feedback_label == 'Bien')
        except Exception:
            pass

        return jsonify({'success': True,
                        'posture': posture,
                        'feedback': feedback_label,
                        'reason': feedback_reason,
                        'metrics': metrics,
                        'pose_size': pose_size,
                        'distance_status': distance_status,
                        'distance_quality': distance_quality,
                        'is_good': is_good,
                        'confidence': confidence})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/process_video_frames', methods=['POST', 'OPTIONS'])
def process_video_frames():
    """Endpoint HTTP para procesar frames de video y extraer landmarks (para app móvil).
    Espera JSON: {'frames': ['data:image/jpeg;base64,...', ...], 'target_fps': 2}
    Devuelve: {'success': True, 'landmarks_sequence': [[...], ...], 'ref_fps': 2}
    """
    if request.method == 'OPTIONS':
        return jsonify({'success': True}), 200
    
    try:
        payload = request.get_json()
        if not payload:
            return jsonify({'success': False, 'message': 'No JSON payload'}), 400
        
        frames_b64 = payload.get('frames', [])
        target_fps = float(payload.get('target_fps', 2))
        
        if not frames_b64:
            return jsonify({'success': False, 'message': 'No frames provided'}), 400
        
        seq = []
        # Procesar cada frame
        for frame_b64 in frames_b64:
            try:
                # Decodificar imagen
                if ',' in frame_b64:
                    frame_b64 = frame_b64.split(',', 1)[1]
                
                img_bytes = base64.b64decode(frame_b64)
                nparr = np.frombuffer(img_bytes, np.uint8)
                frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                if frame is None:
                    continue
                
                # Procesar con MediaPipe
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results = pose.process(frame_rgb)
                if results.pose_landmarks:
                    landmarks = [coord for landmark in results.pose_landmarks.landmark
                                 for coord in [landmark.x, landmark.y, landmark.z]]
                    seq.append(landmarks)
            except Exception as e:
                print(f"Error procesando frame: {e}")
                continue
        
        if not seq:
            return jsonify({'success': False, 'message': 'No se detectaron landmarks en los frames'}), 400
        
        return jsonify({
            'success': True,
            'landmarks_sequence': seq,
            'ref_fps': int(target_fps),
            'frames_count': len(seq)
        })
    
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/set_reference_landmarks', methods=['POST', 'OPTIONS'])
def set_reference_landmarks():
    """Endpoint HTTP para establecer la secuencia de landmarks como referencia (para app móvil).
    Espera JSON: {'landmarks_sequence': [[...], ...], 'ref_fps': 2}
    Guarda la secuencia en current_reference_sequence.
    """
    if request.method == 'OPTIONS':
        return jsonify({'success': True}), 200
    
    global current_reference_landmarks, current_reference_sequence, reference_fps, current_reference_index
    
    try:
        payload = request.get_json()
        if not payload:
            return jsonify({'success': False, 'message': 'No JSON payload'}), 400
        
        landmarks_seq = payload.get('landmarks_sequence', [])
        ref_fps = int(payload.get('ref_fps', 2))
        
        if not landmarks_seq:
            return jsonify({'success': False, 'message': 'No landmarks sequence provided'}), 400
        
        # Guardar secuencia y primera referencia
        current_reference_sequence = landmarks_seq
        current_reference_landmarks = landmarks_seq[0] if landmarks_seq else None
        current_reference_index = 0
        reference_fps = ref_fps
        
        return jsonify({
            'success': True,
            'frames': len(landmarks_seq),
            'ref_fps': ref_fps,
            'message': f'Se establecieron {len(landmarks_seq)} frames de referencia'
        })
    
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/set_reference_video', methods=['POST', 'OPTIONS'])
def set_reference_video_http():
    """Endpoint HTTP para establecer el video de referencia (para app móvil).
    Espera JSON: {'condition': 'condicion', 'video_name': 'nombre_video.mp4', 'target_fps': 2}
    Extrae landmarks del video y los guarda en current_reference_sequence.
    """
    if request.method == 'OPTIONS':
        return jsonify({'success': True}), 200
    
    global current_reference_landmarks, current_reference_sequence, reference_fps, current_reference_index
    
    try:
        payload = request.get_json()
        if not payload:
            return jsonify({'success': False, 'message': 'No JSON payload'}), 400
        
        condition = payload.get('condition')
        video_name = payload.get('video_name')
        
        if not condition or not video_name:
            return jsonify({'success': False, 'message': 'Missing condition or video_name'}), 400
        
        # Construir rutas candidatas al video en el servidor
        candidates = [
            Path('dataset') / condition / video_name,
            Path('..') / 'postura' / 'dataset' / condition / video_name,
            Path('postura') / 'dataset' / condition / video_name,
            Path('app_movil') / 'assets' / 'videos' / condition / video_name,
            Path('..') / 'app_movil' / 'assets' / 'videos' / condition / video_name,
        ]

        video_path = None
        for c in candidates:
            if c.exists():
                video_path = c
                break

        if video_path is None:
            print(f"ERROR: Video no encontrado - {video_name} en {condition}")
            print(f"Rutas probadas: {[str(c) for c in candidates]}")
            return jsonify({'success': False, 'message': f'Video no encontrado en rutas esperadas. Buscado: {video_name} en condition {condition}'}), 404
        
        print(f"INFO: Abriendo video de referencia: {video_path}")
        # Abrir el video
        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            print(f"ERROR: No se pudo abrir el video: {video_path}")
            return jsonify({'success': False, 'message': f'No se pudo abrir el video: {video_path.name}'}), 400
        
        # Configurar muestreo - extraer más frames para mejor detección
        video_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        target_fps = float(payload.get('target_fps', 3))  # Aumentado de 2 a 3 fps
        reference_fps = max(1, int(target_fps))
        step = max(1, int(round(video_fps / target_fps)))
        
        seq = []
        frame_idx = 0
        max_samples = 600  # Duplicado de 300 a 600
        samples = 0
        skipped = 0  # Contador de frames sin detección
        
        print(f"Procesando video de referencia: {video_path}")
        print(f"Video FPS: {video_fps}, Target FPS: {target_fps}, Step: {step}")
        
        # Usar confianza más baja para detectar más poses
        local_pose = mp.solutions.pose.Pose(static_image_mode=True, model_complexity=1,
                                            min_detection_confidence=0.4)  # Reducido de 0.6 a 0.4
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            if frame_idx % step == 0:
                # Procesar con MediaPipe
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results = local_pose.process(frame_rgb)
                if results.pose_landmarks:
                    landmarks = [coord for landmark in results.pose_landmarks.landmark
                                 for coord in [landmark.x, landmark.y, landmark.z]]
                    seq.append(landmarks)
                    samples += 1
                    if samples >= max_samples:
                        print(f"Límite de {max_samples} muestras alcanzado")
                        break
                else:
                    skipped += 1
            
            frame_idx += 1
        
        print(f"Extracción completa - Frames procesados: {frame_idx}, Detecciones: {samples}, Sin detección: {skipped}")
    
        cap.release()
        try:
            local_pose.close()
        except Exception:
            pass
        
        if not seq:
            return jsonify({'success': False, 'message': 'No se detectaron landmarks en el video'}), 400
        
        # Guardar secuencia y primera referencia
        current_reference_sequence = seq
        current_reference_landmarks = seq[0]
        current_reference_index = 0
        
        print(f"Video de referencia establecido: {len(seq)} frames extraídos")
        
        return jsonify({
            'success': True,
            'frames': len(seq),
            'ref_fps': reference_fps,
            'message': f'Se extrajeron {len(seq)} frames de referencia (muestreo {reference_fps} fps)'
        })
    
    except Exception as e:
        print(f"Error estableciendo video de referencia: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/sync_reference_time', methods=['POST', 'OPTIONS'])
def sync_reference_time_http():
    if request.method == 'OPTIONS':
        return jsonify({'success': True}), 200
    """Endpoint HTTP para sincronizar tiempo del video (para app móvil).
    Espera JSON: {'current_time': seconds}
    Actualiza current_reference_index basado en el tiempo.
    """
    global current_reference_index, reference_fps
    try:
        payload = request.get_json()
        if not payload:
            return jsonify({'success': False}), 400
        
        t = float(payload.get('current_time', 0))
        idx = int(round(t * reference_fps))
        current_reference_index = max(0, idx)
        
        return jsonify({'success': True, 'index': current_reference_index})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/ping', methods=['GET'])
def ping():
    print("[PING] /api/ping llamado")
    return jsonify({'success': True, 'message': 'pong'})

@app.route('/api/reference_landmarks', methods=['GET'])
def get_reference_landmarks():
    """Devuelve landmarks de referencia en el índice sincronizado actual.
    Si hay una secuencia cargada, devuelve el frame actual; si no, intenta un landmark único.
    """
    try:
        global current_reference_sequence, current_reference_index, current_reference_landmarks, reference_fps
        if current_reference_sequence:
            idx = min(max(0, current_reference_index), len(current_reference_sequence)-1)
            ref = current_reference_sequence[idx]
            return jsonify({'success': True,
                            'landmarks': ref,
                            'index': idx,
                            'ref_fps': reference_fps})
        elif current_reference_landmarks:
            return jsonify({'success': True,
                            'landmarks': current_reference_landmarks,
                            'index': 0,
                            'ref_fps': reference_fps})
        else:
            return jsonify({'success': False, 'message': 'No reference loaded'}), 404
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


if __name__ == '__main__':
    # Banner de arranque en consola
    print("\n========================================")
    print("Backend Modelo - Flask + SocketIO")
    print("Puerto: 5000 | Host: 0.0.0.0")
    print("Endpoints principales: /api/ping, /api/video/<dataset>/<video>")
    print("========================================\n")
    # Usar socketio.run para mantener soporte SocketIO + Flask routes HTTP
    try:
        print("[BOOT] Iniciando servidor...")
        socketio.run(app, host='0.0.0.0', port=5000, debug=False, allow_unsafe_werkzeug=True)
    except Exception as e:
        import traceback
        print("[BOOT][ERROR] Falló el arranque del servidor:", str(e))
        traceback.print_exc()
        print("Sugerencias: verifica dependencias (Flask/SocketIO), puerto 5000 libre, firewall.")