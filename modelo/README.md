## Integrantes del proyecto

| Nombre                                  |
| Luz Amairani Martinez Monroy            |

---

## Descarga del modelo de MediaPipe

```sh
wget -O pose_landmarker.task https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task
```
> Si usas Windows y no tienes `wget`, puedes descargar el archivo manualmente desde el enlace anterior.
---

## Descripción
---

## Pasos realizados

### 1. Propuesta y planteamiento

Se propone un sistema capaz de clasificar posturas humanas a partir de imágenes o video, usando los landmarks del cuerpo extraídos con MediaPipe. El objetivo es entrenar un modelo de machine learning que reconozca diferentes posturas.

> [!TIP]

### 2. Recolección de imágenes

- Se crearon carpetas para cada postura en `dataset/`.
- Las imágenes se recolectaron de internet y mediante la webcam usando [`captura_imagenes.py`](captura_imagenes.py).
- No es indispensable almacenar todas las imágenes, pero se recomienda para reproducibilidad.

> [!IMPORTANT]
> Asegúrate de tener suficientes imágenes variadas para cada clase de postura para mejorar la precisión del modelo.

### 3. Extracción de características con MediaPipe

- Se utilizó [`procesar_imagenes.py`](procesar_imagenes.py) para procesar las imágenes y extraer los landmarks del cuerpo usando MediaPipe.
- Los datos extraídos se guardaron en un archivo CSV: [`dataset_posturas.csv`](dataset_posturas.csv).

> [!WARNING]
> Verifica que todas las imágenes sean procesadas correctamente; imágenes mal procesadas pueden afectar el entrenamiento.

### 4. Entrenamiento del modelo

### 5. Prueba del modelo
- Se evaluó el modelo con un conjunto de prueba y se generó un reporte de clasificación.
- Se puede realizar clasificación en tiempo real con [`clasificar_tiempo_real.py`](clasificar_tiempo_real.py).

- Se desarrolló una aplicación web con Flask y SocketIO en [`app.py`](app.py).
- La interfaz web permite ver la cámara y la postura detectada en tiempo real ([`templates/index.html`](templates/index.html)).

---

## Requisitos (actualizados)

- Python 3.9
- MediaPipe 0.10.5
- Protobuf 3.20.3
- scikit-learn
- Flask + Flask-SocketIO
- OpenCV

Instalar dependencias:
```powershell
pip install -r requirements.txt
```

> [!NOTE]
> Versiones probadas y estables están fijadas en `requirements.txt` para evitar incompatibilidades (TensorFlow no es requerido).

---

## Estructura del repositorio

```
proyecto_postura/
│
├── app.py
├── captura_imagenes.py
├── clasificar_tiempo_real.py
├── entrenar_modelo.py
├── procesar_imagenes.py
├── dataset/
│   ├── [escoliosis lumbar]/
│   ├── [espondilolisis]/
│   ├── [hernia de disco lumbar]/
│   ├── [lumbalgia mecánica inespecífica]/
├── dataset_posturas.csv
├── modelo_posturas.pkl
├── encoder.pkl
├── requirements.txt
├── README.md
└── templates/
   └── index.html
```

---

## Uso rápido (actualizado)

1. **Recolectar imágenes:**  
   Ejecutar `captura_imagenes.py` o agregar imágenes a `dataset/`.

2. **Generar dataset desde videos con mayor cobertura (3 fps):**  
   ```
   python entrenar_modelo.py --videos-only --fps 3
   ```
  
3. **Entrenar el modelo (estricto):**  
   - El script guarda `modelo_posturas.pkl` y `encoder.pkl` automáticamente.

4. **Iniciar la aplicación web (backend):**  
   ```
   python app.py
   ```

### Notas de reentrenamiento estricto
- Se normalizan los landmarks por escala del torso (robustez a distancia/encuadre).
- El clasificador usa `RandomForest(n_estimators=400, max_depth=12, min_samples_leaf=2)`.
- Si una clase tiene pocas muestras, incremente `--fps` o añada más videos.

---

## Estado del proyecto

- [x] Recolección de imágenes
- [x] Procesamiento y extracción de landmarks
- [x] Entrenamiento del modelo
- [x] Clasificación en tiempo real
- [x] Aplicación web

> [!INFO]
> El proyecto está completo y funcionando. Se recomienda seguir los pasos de este README para reproducir el sistema.