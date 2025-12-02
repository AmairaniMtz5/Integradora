import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Video, Audio } from "expo-av";
import { SERVER_URL } from "../config";
import { supabase } from "../supabaseClient";
import { saveExerciseSession, saveExerciseProgress } from "../utils/supabaseHelpers";

// Stubs de sonido para evitar ReferenceError si todavía no hay implementación de audio
// Se pueden reemplazar posteriormente por carga de sonidos con expo-av
const playSuccessSound = () => {};
const playErrorSound = () => {};

// Utilidad: extraer número objetivo de repeticiones desde string (ej. "10", "10 x 3", "10-12")
const parseTargetReps = (reps) => {
  if (!reps) return null;
  try {
    const m = String(reps).match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
  } catch {
    return null;
  }
};

// Mapeo de videos disponibles - usar URIs del servidor en lugar de require()
// Esto permite que el decodificador nativo del dispositivo maneje el formato
const AVAILABLE_VIDEOS = {
  "escoliosis lumbar": [
    { name: "Ambas rodillas al pecho.mp4", src: { uri: `${SERVER_URL}/api/video/escoliosis lumbar/Ambas rodillas al pecho.mp4` } },
    { name: "Cubito supino.mp4", src: { uri: `${SERVER_URL}/api/video/escoliosis lumbar/Cubito supino.mp4` } },
    { name: "Perro de caza.mp4", src: { uri: `${SERVER_URL}/api/video/escoliosis lumbar/Perro de caza.mp4` } },
    { name: "Plancha lateral.mp4", src: { uri: `${SERVER_URL}/api/video/escoliosis lumbar/Plancha lateral.mp4` } },
    { name: "Postura del Avion.mp4", src: { uri: `${SERVER_URL}/api/video/escoliosis lumbar/Postura del Avion.mp4` } },
    { name: "Puente.mp4", src: { uri: `${SERVER_URL}/api/video/escoliosis lumbar/Puente.mp4` } },
    { name: "Rodilla al pecho.mp4", src: { uri: `${SERVER_URL}/api/video/escoliosis lumbar/Rodilla al pecho.mp4` } },
  ],
  "espondilolisis": [
    { name: "Abdominales.mp4", src: { uri: `${SERVER_URL}/api/video/espondilolisis/Abdominales.mp4` } },
    { name: "Ambas rodillas al pecho.mp4", src: { uri: `${SERVER_URL}/api/video/espondilolisis/Ambas rodillas al pecho.mp4` } },
    { name: "Perro de caza.mp4", src: { uri: `${SERVER_URL}/api/video/espondilolisis/Perro de caza.mp4` } },
    { name: "Plancha sobre codos.mp4", src: { uri: `${SERVER_URL}/api/video/espondilolisis/Plancha sobre codos.mp4` } },
    { name: "Puente.mp4", src: { uri: `${SERVER_URL}/api/video/espondilolisis/Puente.mp4` } },
    { name: "Rodilla al pecho.mp4", src: { uri: `${SERVER_URL}/api/video/espondilolisis/Rodilla al pecho.mp4` } },
  ],
  "hernia de disco lumbar": [
    { name: "Ambas rodillas al pecho.mp4", src: { uri: `${SERVER_URL}/api/video/hernia de disco lumbar/Ambas rodillas al pecho.mp4` } },
    { name: "El perro y gato.mp4", src: { uri: `${SERVER_URL}/api/video/hernia de disco lumbar/El perro y gato.mp4` } },
    { name: "En cuatro puntos.mp4", src: { uri: `${SERVER_URL}/api/video/hernia de disco lumbar/En cuatro puntos.mp4` } },
    { name: "Piernas al abdomen.mp4", src: { uri: `${SERVER_URL}/api/video/hernia de disco lumbar/Piernas al abdomen.mp4` } },
    { name: "Posicion de cobra.mp4", src: { uri: `${SERVER_URL}/api/video/hernia de disco lumbar/Posicion de cobra.mp4` } },
    { name: "Posicion de esfinge.mp4", src: { uri: `${SERVER_URL}/api/video/hernia de disco lumbar/Posicion de esfinge.mp4` } },
    { name: "Rodilla al pecho.mp4", src: { uri: `${SERVER_URL}/api/video/hernia de disco lumbar/Rodilla al pecho.mp4` } },
  ],
  "lumbalgia mecánica inespecífica": [
    { name: "Abdominales (pierna contraria).mp4", src: { uri: `${SERVER_URL}/api/video/lumbalgia mecánica inespecífica/Abdominales (pierna contraria).mp4` } },
    { name: "Abdominales (pierna del mismo lado).mp4", src: { uri: `${SERVER_URL}/api/video/lumbalgia mecánica inespecífica/Abdominales (pierna del mismo lado).mp4` } },
    { name: "Abdominales.mp4", src: { uri: `${SERVER_URL}/api/video/lumbalgia mecánica inespecífica/Abdominales.mp4` } },
    { name: "El perro y gato.mp4", src: { uri: `${SERVER_URL}/api/video/lumbalgia mecánica inespecífica/El perro y gato.mp4` } },
    { name: "Extension de la columna.mp4", src: { uri: `${SERVER_URL}/api/video/lumbalgia mecánica inespecífica/Extension de la columna.mp4` } },
    { name: "Inclinacion pelvica de pie.mp4", src: { uri: `${SERVER_URL}/api/video/lumbalgia mecánica inespecífica/Inclinacion pelvica de pie.mp4` } },
    { name: "Perro de caza.mp4", src: { uri: `${SERVER_URL}/api/video/lumbalgia mecánica inespecífica/Perro de caza.mp4` } },
    { name: "Plancha lateral.mp4", src: { uri: `${SERVER_URL}/api/video/lumbalgia mecánica inespecífica/Plancha lateral.mp4` } },
    { name: "Puente.mp4", src: { uri: `${SERVER_URL}/api/video/lumbalgia mecánica inespecífica/Puente.mp4` } },
  ],
};

export default function VideoRefScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState("loading");
  const [selectedCondition, setSelectedCondition] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [assignedExercises, setAssignedExercises] = useState([]);
  const [patientData, setPatientData] = useState(null);
  const [loadingExercises, setLoadingExercises] = useState(true);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [mensajePostura, setMensajePostura] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [facing, setFacing] = useState("front");
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [isVideoExpanded, setIsVideoExpanded] = useState(false);
  const [noMovementWarning, setNoMovementWarning] = useState(false);
  const [lastMovementTime, setLastMovementTime] = useState(Date.now());
  const [distanceWarning, setDistanceWarning] = useState(null);
  const [connectionError, setConnectionError] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const cameraRef = useRef(null);
  const videoRef = useRef(null);
  const [videoLayout, setVideoLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const syncIntervalRef = useRef(null);
  const previousFrameRef = useRef(null);
  const movementLevelRef = useRef(0);
  const [movementLevel, setMovementLevel] = useState(0); // Para ajustar opacidad dinámica
  const [referenceLandmarks, setReferenceLandmarks] = useState(null);
  const [showOptimalDistance, setShowOptimalDistance] = useState(false);
  // Progreso de sesión
  const sessionStartRef = useRef(null);
  const [goodReps, setGoodReps] = useState(0);
  const [badReps, setBadReps] = useState(0);
  const lastGoodTsRef = useRef(0);
  const lastIsGoodRef = useRef(false);
  const lastEvalTsRef = useRef(0);
  const targetInfoRef = useRef({ targetReps: null, targetSeconds: null });

  // Inicializar inicio de sesión cuando entramos a recording (fallback)
  useEffect(() => {
    if (step === 'recording' && !sessionStartRef.current) {
      sessionStartRef.current = Date.now();
    }
  }, [step]);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission]);

  // Cargar ejercicios asignados al paciente
  useEffect(() => {
    loadAssignedExercises();
  }, []);

  const loadAssignedExercises = async () => {
    try {
      setLoadingExercises(true);
      
      // Obtener usuario autenticado
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.log('Usuario no autenticado, usando ejercicios por defecto');
        setStep('select_condition');
        setLoadingExercises(false);
        return;
      }

      console.log('Buscando paciente para user:', user.id, user.email);

      // Buscar datos del paciente por user_id
      let { data: patient, error: patientError } = await supabase
        .from('patients')
        .select('id, first_name, last_name, medical_history')
        .eq('user_id', user.id)
        .maybeSingle();

      // Si no se encuentra por user_id, buscar por email
      if (!patient) {
        console.log('Buscando por email...');
        const { data: patientByEmail } = await supabase
          .from('patients')
          .select('id, first_name, last_name, medical_history, user_id')
          .eq('email', user.email)
          .maybeSingle();
        
        if (patientByEmail) {
          patient = patientByEmail;
          // Vincular user_id si no existe
          if (!patientByEmail.user_id) {
            await supabase
              .from('patients')
              .update({ user_id: user.id })
              .eq('email', user.email);
          }
        }
      }

      if (!patient) {
        console.log('Paciente no encontrado, usando ejercicios por defecto');
        setStep('select_condition');
        setLoadingExercises(false);
        return;
      }

      console.log('Paciente encontrado:', patient);
      setPatientData(patient);

      // --- Leer ejercicios asignados directamente con toda la info ---
      let assignedRows = [];
      try {
        console.log('Consultando assigned_exercises para patient_id:', patient.id);
        
        const { data, error } = await supabase
          .from('assigned_exercises')
          .select('*')
          .eq('patient_id', patient.id);
        
        if (error) {
          console.error('Error cargando assigned_exercises:', error);
          console.error('Error detalles:', JSON.stringify(error));
        } else {
          assignedRows = data || [];
          console.log('Ejercicios asignados encontrados:', assignedRows.length);
          if (assignedRows.length > 0) {
            console.log('Primer ejercicio:', assignedRows[0]);
          }
        }
      } catch (e) {
        console.log('Excepción leyendo assigned_exercises:', e.message);
      }

      if (assignedRows.length === 0) {
        console.log('No hay ejercicios asignados para el paciente');
        setStep('select_condition');
        return;
      }

      // Mapear directamente desde assigned_exercises (ya tiene pathology y exercise_id)
      const finalExercises = assignedRows.map(row => {
        // Construir nombre legible desde exercise_id (ej: "hernia-ambas-rodillas-al-pecho" -> "Ambas rodillas al pecho")
        const exerciseName = row.exercise_id
          .split('-')
          .slice(1) // Quitar primera parte (patología)
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        
        // Construir video_url esperada por el servidor
        const videoFileName = `${exerciseName}.mp4`;
        const pathologyFolder = row.pathology === 'hernia' ? 'hernia de disco lumbar' : row.pathology;
        const videoUrl = `${SERVER_URL}/api/video/${encodeURIComponent(pathologyFolder)}/${encodeURIComponent(videoFileName)}`;
        
        return {
          id: row.exercise_id,
          name: videoFileName,
          pathology: pathologyFolder,
          videoUrl: videoUrl,
          src: { uri: videoUrl },
          status: 'approved',
          reps: row.therapist_reps,
          days: row.therapist_assigned_days,
          notes: row.therapist_notes,
          week: row.assignment_week
        };
      });

      if (finalExercises.length > 0) {
        console.log('Ejercicios finales cargados (sin relaciones PostgREST):', finalExercises.length);
        setAssignedExercises(finalExercises);
        setStep('select_exercise');
      } else {
        setStep('select_condition');
      }
    } catch (err) {
      console.error('Error en loadAssignedExercises:', err);
      setStep('select_condition');
    } finally {
      setLoadingExercises(false);
    }
  };

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission]);

  useEffect(() => {
    if (step === 'recording') {
      const t = setTimeout(() => {
        if (!distanceWarning && !noMovementWarning && !connectionError && !videoError) {
          setShowOptimalDistance(true);
        }
      }, 2000);
      return () => clearTimeout(t);
    } else {
      setShowOptimalDistance(false);
    }
  }, [step, distanceWarning, noMovementWarning, connectionError, videoError]);

  // ⭐ Detección de movimiento en tiempo real (sin capturar fotos)
  // Aprovecha el stream de cámara y estima movimiento por diferencia de luminancia
  const onCameraFrame = async (frame) => {
    try {
      // frame: { width, height, data } – asumimos RGBA/ARGB
      const data = frame?.data;
      if (!data) return;

      // Calcular energía de movimiento básica comparando con frame previo
      const prev = previousFrameRef.current;
      let diffSum = 0;
      let count = 0;
      if (prev && prev.length === data.length) {
        for (let i = 0; i < data.length; i += 4) {
          // Luma aproximada
          const y1 = (data[i] * 0.299) + (data[i + 1] * 0.587) + (data[i + 2] * 0.114);
          const y0 = (prev[i] * 0.299) + (prev[i + 1] * 0.587) + (prev[i + 2] * 0.114);
          diffSum += Math.abs(y1 - y0);
          count++;
        }
      }
      previousFrameRef.current = data;

      if (count > 0) {
        const avgDiff = diffSum / count; // 0-255 aprox
        // Normalizar a 0-1 y suavizar
        const level = Math.min(1, Math.max(0, avgDiff / 25));
        movementLevelRef.current = movementLevelRef.current * 0.85 + level * 0.15;
        // Actualizar estado (throttling ligero cada ~200ms)
        if (!lastMovementTime || Date.now() - lastMovementTime > 200) {
          setMovementLevel(movementLevelRef.current);
        }

        // Aviso de no movimiento si bajo por cierto tiempo (más tolerante)
        const now = Date.now();
        if (movementLevelRef.current > 0.05) {
          setNoMovementWarning(false);
          setLastMovementTime(now);
        } else if (now - lastMovementTime > 5000) {
          setNoMovementWarning(true);
        }
      }
    } catch (e) {
      // Silenciar errores de procesamiento de frame
    }
  };

  // ⭐ Evaluación en vivo sin capturas: solo sincroniza tiempo y muestra overlay de referencia
  // El feedback se limita a detección de movimiento y avisos de distancia locales.

  // ⭐ Efecto de sincronización de tiempo del video con servidor
  useEffect(() => {
    if (step === "recording" && videoLoaded && videoCurrentTime !== null) {
      // Limpiar intervalo anterior si existe
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }

      // Emitir tiempo cada 250ms al servidor (igual que en web) y obtener landmarks de referencia
      syncIntervalRef.current = setInterval(async () => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 segundos timeout para sync
          
          await fetch(`${SERVER_URL}/api/sync_reference_time`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ current_time: videoCurrentTime }),
            signal: controller.signal,
          });
          
          // Landmarks removidos: no se obtienen del servidor

          clearTimeout(timeoutId);
        } catch (err) {
          // Silenciar errores de sincronización (no es crítico)
          // Solo loguear si no es un error de aborto
          if (err.name !== 'AbortError') {
            console.log("Sync error (non-blocking):", err.message);
          }
        }
      }, 250);
    }

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [step, videoLoaded, videoCurrentTime]);

  // ⭐ Detección de movimiento mejorada: compara hash de frames consecutivos
  // (Se usa principalmente como respaldo, la detección principal se hace con la respuesta del servidor)
  const detectMovement = (currentBase64) => {
    if (!previousFrameRef.current) {
      previousFrameRef.current = currentBase64.substring(0, 1000); // Guardar solo una porción para comparación rápida
      return true; // Primer frame, asumir movimiento
    }

    // Comparación mejorada: comparar una porción del hash para detectar cambios significativos
    const currentHash = currentBase64.substring(0, 1000);
    const previousHash = previousFrameRef.current;
    
    // Calcular diferencia simple (número de caracteres diferentes)
    let differences = 0;
    const minLength = Math.min(currentHash.length, previousHash.length);
    for (let i = 0; i < minLength; i++) {
      if (currentHash[i] !== previousHash[i]) {
        differences++;
      }
    }
    
    // Si hay más del 5% de diferencias, hay movimiento
    const hasMovement = differences > (minLength * 0.05);
    previousFrameRef.current = currentHash;
    
    return hasMovement;
  };

  // Captura periódica y evaluación remota (SIN mostrar capturas, solo feedback)
  useEffect(() => {
    let captureInterval;
    let movementCheckInterval;

    const doCapture = async () => {
      try {
        // ⭐ Verificar que la cámara esté lista y disponible
        if (!cameraRef.current) {
          console.log("Camera ref is null, skipping capture");
          setIsEvaluating(false);
          return;
        }

        if (!cameraRef.current.takePictureAsync) {
          console.log("takePictureAsync not available, camera may not be ready");
          setIsEvaluating(false);
          return;
        }

        if (isEvaluating) {
          return; // Ya hay una evaluación en curso
        }

        // No capturar si la cámara aún no está lista
        if (!isCameraReady) {
          console.log("Camera not ready, delaying capture");
          setIsEvaluating(false);
          return;
        }

        setIsEvaluating(true);
        let photo = null;
        try {
          photo = await cameraRef.current.takePictureAsync({
            quality: 0.2, // Calidad muy baja para máxima velocidad
            base64: true,
            skipProcessing: true,
          });
        } catch (captureErr) {
          console.log("capture attempt failed, retrying:", captureErr);
          // retries con backoff
          let retryDelay = 400;
          for (let attempt = 1; attempt <= 2; attempt++) {
            await new Promise((res) => setTimeout(res, retryDelay));
            retryDelay *= 2;
            if (!cameraRef.current || !cameraRef.current.takePictureAsync) {
              console.log("Camera not available on retry", attempt);
              continue;
            }
            try {
              photo = await cameraRef.current.takePictureAsync({
                quality: 0.25,
                base64: true,
                skipProcessing: true,
              });
              break; // éxito
            } catch (e) {
              console.log("retry capture failed", attempt, e);
            }
          }
          
          if (!photo) {
            setMensajePostura("Cámara no disponible");
            setShowFeedback(true);
            setTimeout(() => setShowFeedback(false), 1500);
            setIsEvaluating(false);
            return; // abort this cycle
          }
        }

        if (photo && photo.base64) {
          // ⭐ Detectar movimiento básico (respaldo)
          detectMovement(photo.base64);

          try {
            // ⭐ Timeout aumentado y mejor manejo de errores
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 segundos timeout

            const resp = await fetch(`${SERVER_URL}/api/evaluate_frame`, {
              method: "POST",
              headers: { 
                "Content-Type": "application/json",
                "Accept": "application/json",
              },
              body: JSON.stringify({
                image: `data:image/jpeg;base64,${photo.base64}`,
                // ⭐ Enviar información del video de referencia para sincronización
                reference_video: selectedVideo ? {
                  condition: selectedCondition,
                  video_name: selectedVideo.name,
                  current_time: videoCurrentTime,
                } : null,
              }),
              signal: controller.signal,
            }).catch((fetchError) => {
              clearTimeout(timeoutId);
              throw fetchError;
            });

            clearTimeout(timeoutId);
            setConnectionError(false);

            if (!resp || !resp.ok) {
              throw new Error(`HTTP error! status: ${resp ? resp.status : 'no response'}`);
            }

            const j = await resp.json();
            if (j && j.success) {
              const serverFeedback = (j.feedback || "Evaluado");
              const serverMetrics = j.metrics || {};
              const posture = j.posture || null;
              const distanceStatus = j.distance_status || null;
              const distanceQuality = j.distance_quality || null; // 'near','optimal','far'
              const poseSize = j.pose_size || null;
              const serverIsGood = (typeof j.is_good === 'boolean') ? j.is_good : null;
              const serverConfidence = (typeof j.confidence === 'number') ? j.confidence : null;

              // ⭐ Detección de movimiento y distancia mejorada
              if (posture && posture !== "No detectada") {
                setLastMovementTime(Date.now());
                setNoMovementWarning(false);
                
                // ⭐ Detección de distancia usando distance_quality simplificada
                const lowerBodyVisible = (serverMetrics && serverMetrics.visible_lower_body === true);
                // Solo advertir si realmente está muy lejos o muy cerca
                if (distanceQuality === 'near') {
                  setDistanceWarning('too_close');
                } else if (distanceQuality === 'far') {
                  // Solo mostrar "too_far" si además no hay cuerpo inferior visible
                  if (!lowerBodyVisible) {
                    setDistanceWarning('too_far');
                  } else {
                    setDistanceWarning(null);
                  }
                } else if (distanceQuality === 'optimal') {
                  setDistanceWarning(null);
                } else {
                  // fallback al status antiguo si no llega quality
                  if (distanceStatus === 'too_close') setDistanceWarning('too_close');
                  else if (distanceStatus === 'too_far' && !lowerBodyVisible) setDistanceWarning('too_far');
                  else setDistanceWarning(null);
                }
              } else {
                // Si no se detecta postura, puede ser falta de movimiento o persona fuera de frame
                const timeSinceLastMovement = Date.now() - lastMovementTime;
                if (timeSinceLastMovement > 3000) {
                  // Solo mostrar aviso si ya pasaron 3 segundos sin detección
                  setNoMovementWarning(true);
                }
                // Si no hay postura detectada, probablemente está muy lejos o fuera de frame
                // Solo mostrar aviso de distancia si no hay aviso de movimiento (para no duplicar)
                if (timeSinceLastMovement <= 3000) {
                  setDistanceWarning('too_far');
                }
              }

              // ⭐ Priorizar valor booleano del servidor si está disponible
              let isGood = false;
              let displayText = "Evaluando...";

              if (!posture || posture === "No detectada") {
                displayText = "No se detecta postura";
              } else if (serverIsGood !== null) {
                isGood = serverIsGood;
                displayText = isGood ? "Bien — ¡Buen movimiento!" : "Mal — Ajusta la postura";
                // Si tenemos confianza numérica, podemos mostrarla en métricas
                if (serverConfidence !== null && serverConfidence >= 0) {
                  setMetrics((prev) => ({ ...prev, server_confidence: serverConfidence }));
                }
              } else if (serverFeedback) {
                const feedbackLower = serverFeedback.toLowerCase();
                if (feedbackLower.includes("sin evaluación") || feedbackLower.includes("no hay datos")) {
                  displayText = "Esperando detección...";
                } else {
                  isGood = feedbackLower.includes("bien") || feedbackLower.includes("excelente") || feedbackLower.includes("buena");
                  displayText = isGood ? "Bien — ¡Buen movimiento!" : "Mal — Ajusta la postura";
                }
              } else if (serverMetrics && typeof serverMetrics.avg_distance === "number") {
                isGood = serverMetrics.avg_distance < 0.08;
                if (serverMetrics.max_distance && serverMetrics.max_distance > 0.20) {
                  isGood = false;
                }
                displayText = isGood ? "Bien — ¡Buen movimiento!" : "Mal — Ajusta la postura";
              } else {
                displayText = "Evaluando...";
              }

              // ⭐ Conteo de repeticiones (aciertos/errores) con antirrebote
              try {
                const nowTs = Date.now();
                const cooldown = 1000; // mínimo 1s entre conteos

                if (serverIsGood === true) {
                  if (!lastIsGoodRef.current && (nowTs - lastGoodTsRef.current > cooldown)) {
                    setGoodReps((prev) => prev + 1);
                    lastGoodTsRef.current = nowTs;
                  }
                  lastIsGoodRef.current = true;
                } else if (serverIsGood === false && posture && posture !== "No detectada") {
                  if (lastIsGoodRef.current && (nowTs - lastGoodTsRef.current > cooldown)) {
                    setBadReps((prev) => prev + 1);
                    lastGoodTsRef.current = nowTs;
                  }
                  lastIsGoodRef.current = false;
                }
                lastEvalTsRef.current = nowTs;
              } catch (e) {
                // Silenciar errores de conteo para no afectar la UI
              }

              // ⭐ Reproducir sonido según resultado
              if (isGood) {
                playSuccessSound();
              } else if (posture && posture !== "No detectada") {
                playErrorSound();
              }

              setMensajePostura(displayText);
              setMetrics(serverMetrics);
            } else {
              setMensajePostura("Error de evaluación");
              setConnectionError(false); // Si hay respuesta pero no success, no es error de conexión
            }
          } catch (err) {
            console.log("Network eval error", err);
            
            // Si es timeout, no marcar como error de conexión (es normal con server ocupado)
            if (err.name === 'AbortError') {
              // Simplemente saltar esta evaluación, la siguiente intentará de nuevo
              setMensajePostura("Procesando...");
              setConnectionError(false);
            } else {
              setConnectionError(true);
              setNoMovementWarning(false);
              setDistanceWarning(null);
              
              if (err.message && err.message.includes('Network request failed')) {
                setMensajePostura("Error de red - Verifica el servidor");
              } else if (err.message && err.message.includes('Failed to fetch')) {
                setMensajePostura("No se puede conectar al servidor");
              } else {
                setMensajePostura("Error de conexión");
              }
            }
          }

          setShowFeedback(true);
          setTimeout(() => setShowFeedback(false), 2000); // Mostrar feedback 2s
          setIsEvaluating(false);
        } else {
          // Si no hay foto, resetear estado
          setIsEvaluating(false);
        }
      } catch (e) {
        console.log("capture error", e);
        setIsEvaluating(false);
      }
    };

    // ⭐ Verificar movimiento periódicamente
    const checkMovement = () => {
      const timeSinceLastMovement = Date.now() - lastMovementTime;
      // Si no hay movimiento por más de 5 segundos, mostrar aviso
      if (timeSinceLastMovement > 5000) {
        setNoMovementWarning(true);
      } else {
        setNoMovementWarning(false);
      }
    };

    if (step === "recording" && isCameraReady) {
      doCapture();
      captureInterval = setInterval(doCapture, 1500); // Evaluar cada 1.5s
      movementCheckInterval = setInterval(checkMovement, 2000); // Verificar movimiento cada 2s
    }

    return () => {
      if (captureInterval) clearInterval(captureInterval);
      if (movementCheckInterval) clearInterval(movementCheckInterval);
    };
  }, [step, isCameraReady, isEvaluating, lastMovementTime]);

  if (!permission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.text}>Verificando permisos de cámara...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.text}>Se necesita acceso a la cámara</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Dar permiso</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Paso 1: Cargar ejercicios asignados
  if (step === "loading") {
    return (
      <View style={styles.previewContainer}>
        <ActivityIndicator size="large" color="#7a8ce2" />
        <Text style={styles.loadingText}>Cargando ejercicios...</Text>
      </View>
    );
  }

  // Paso 2: Mostrar ejercicios asignados por el terapeuta
  if (step === "select_exercise" && assignedExercises.length > 0) {
    return (
      <View style={styles.exerciseGalleryContainer}>
        <View style={styles.galleryHeader}>
          <TouchableOpacity
            style={styles.galleryBackButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.galleryHeaderText}>
            <Text style={styles.galleryTitle}>
              {patientData ? patientData.first_name : 'Tus ejercicios'}
            </Text>
            <Text style={styles.gallerySubtitle}>
              {assignedExercises.length} ejercicio{assignedExercises.length !== 1 ? 's' : ''} asignado{assignedExercises.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
        
        <FlatList
          data={assignedExercises}
          keyExtractor={(item, idx) => `${item.id}-${idx}`}
          contentContainerStyle={styles.exerciseCardsContainer}
          renderItem={({ item: exercise, index }) => (
            <TouchableOpacity
              style={styles.exerciseCard}
              activeOpacity={0.9}
              onPress={async () => {
                setSelectedVideo(exercise);
                setSelectedCondition(exercise.pathology);
                // Inicia sesión de progreso
                sessionStartRef.current = Date.now();
                setGoodReps(0);
                setBadReps(0);
                lastGoodTsRef.current = 0;
                lastIsGoodRef.current = false;
                lastEvalTsRef.current = 0;
                targetInfoRef.current = {
                  targetReps: parseTargetReps(exercise.reps),
                  targetSeconds: null,
                };
                try {
                  await fetch(`${SERVER_URL}/api/set_reference_video`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      condition: exercise.pathology,
                      video_name: exercise.name,
                      target_fps: 2,
                    })
                  });
                } catch (e) {
                  console.log('Error setting reference video:', e);
                }
                setStep("recording");
              }}
            >
              <View style={styles.exerciseCardImageContainer}>
                <Video
                  source={exercise.src}
                  style={styles.exerciseCardVideo}
                  resizeMode="cover"
                  shouldPlay={false}
                  isMuted
                  positionMillis={1000}
                />
                <View style={styles.exerciseCardOverlay} />
                <View style={styles.exerciseCardBadges}>
                  <View style={styles.levelBadge}>
                    <Text style={styles.levelBadgeText}>{exercise.pathology?.split(' ')[0] || 'General'}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.exerciseCardContent}>
                <Text style={styles.exerciseCardTitle} numberOfLines={2}>
                  {exercise.name.replace('.mp4', '')}
                </Text>
                <View style={styles.exerciseDetailsContainer}>
                  {exercise.reps && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Repeticiones:</Text>
                      <Text style={styles.detailValue}>{exercise.reps}</Text>
                    </View>
                  )}
                  {exercise.days && exercise.days.length > 0 && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Días:</Text>
                      <Text style={styles.detailValue}>{exercise.days.join(', ')}</Text>
                    </View>
                  )}
                  {exercise.week && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Semana:</Text>
                      <Text style={styles.detailValue}>{exercise.week}</Text>
                    </View>
                  )}
                  {exercise.notes && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Notas:</Text>
                      <Text style={styles.detailValue} numberOfLines={2}>{exercise.notes}</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
    );
  }

  // Paso 3: Seleccionar condición médica (fallback si no hay asignados)
  if (step === "select_condition") {
    return (
      <View style={styles.previewContainer}>
        <Text style={styles.title}>Selecciona una condición médica</Text>
        <ScrollView style={styles.listContainer}>
          {Object.keys(AVAILABLE_VIDEOS).map((condition) => (
            <TouchableOpacity
              key={condition}
              style={styles.conditionButton}
              onPress={() => {
                setSelectedCondition(condition);
                setStep("select_video");
              }}
            >
              <Text style={styles.conditionButtonText}>{condition}</Text>
              <Ionicons name="chevron-forward" size={24} color="#7a8ce2" />
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>⬅ Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Paso 2: Seleccionar video
  if (step === "select_video" && selectedCondition) {
    const videos = AVAILABLE_VIDEOS[selectedCondition] || [];
    return (
      <View style={styles.previewContainer}>
        <Text style={styles.title}>Elige un video de referencia</Text>
        <Text style={styles.subtitle}>{selectedCondition}</Text>
        <ScrollView style={styles.listContainer}>
          {videos.map((video, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.videoButton}
              onPress={async () => {
                  setSelectedVideo(video);
                  // Avisar al backend que se usará este video como referencia para extraer landmarks
                      // Inicializa sesión para flujo fallback sin parámetros del terapeuta
                      sessionStartRef.current = Date.now();
                      setGoodReps(0);
                      setBadReps(0);
                      lastGoodTsRef.current = 0;
                      lastIsGoodRef.current = false;
                      lastEvalTsRef.current = 0;
                      targetInfoRef.current = { targetReps: null, targetSeconds: null };
                  try {
                    await fetch(`${SERVER_URL}/api/set_reference_video`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        condition: selectedCondition,
                        video_name: video.name,
                        target_fps: 2,
                      })
                    });
                  } catch (e) {
                    // Silenciar errores; seguiremos pidiendo /api/reference_landmarks durante la grabación
                  }
                  setStep("recording");
                }}
            >
              <Ionicons name="play-circle" size={32} color="#7a8ce2" />
              <Text style={styles.videoButtonText}>{video.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            setSelectedCondition(null);
            setStep("select_condition");
          }}
        >
          <Text style={styles.backText}>⬅ Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Paso 3: Grabación y evaluación en tiempo real
  if (step === "recording" && selectedCondition && selectedVideo) {
    // Handler para salir de grabación guardando progreso
    const handleExitRecording = async () => {
      try {
        const startMs = sessionStartRef.current || Date.now();
        const endMs = Date.now();
        const targetReps = targetInfoRef.current?.targetReps ?? null;
        const targetSeconds = targetInfoRef.current?.targetSeconds ?? null;
        const completed = (targetReps != null) ? (goodReps >= targetReps) : false;

        if (patientData && selectedVideo) {
          await saveExerciseProgress({
            exercise_id: selectedVideo.id || selectedVideo.name, // fallback flujo sin asignación
            exercise_name: selectedVideo.name?.replace('.mp4','') || 'Ejercicio',
            pathology: selectedCondition,
            started_at_ts: startMs,
            ended_at_ts: endMs,
            target_reps: targetReps,
            target_seconds: targetSeconds,
            completed_reps: (goodReps || 0) + (badReps || 0),
            good_reps: goodReps || 0,
            bad_reps: badReps || 0,
            completed,
            days: Array.isArray(selectedVideo.days) ? selectedVideo.days : null,
            week: selectedVideo.week ?? null,
            notes: selectedVideo.notes ?? null,
            metrics: metrics || null,
          });
        }
      } catch (e) {
        console.log('Error guardando progreso:', e?.message || e);
      } finally {
        // Reset de estado mínimo
        sessionStartRef.current = null;
        setGoodReps(0);
        setBadReps(0);
        lastGoodTsRef.current = 0;
        lastIsGoodRef.current = false;
        lastEvalTsRef.current = 0;
      }
    };

    return (
      <View style={styles.container}>
        <CameraView
          style={styles.camera}
          ref={cameraRef}
          facing={facing}
          onCameraReady={() => setIsCameraReady(true)}
        />

        

        {/* ⭐ Video de referencia en overlay (PiP) - Versión compacta en esquina inferior izquierda */}
        {!isVideoExpanded && selectedVideo && (
          <TouchableOpacity
            style={styles.videoPiPContainer}
            onPress={() => setIsVideoExpanded(true)}
            activeOpacity={0.8}
          >
            {/* Leyenda opcional de colores */}
            <View style={styles.colorLegend} pointerEvents="none">
              <View style={styles.colorLegendRow}><View style={[styles.colorSwatch,{backgroundColor:'#FFC107'}]} /><Text style={styles.colorLegendText}>Brazo Izq</Text></View>
              <View style={styles.colorLegendRow}><View style={[styles.colorSwatch,{backgroundColor:'#FF5722'}]} /><Text style={styles.colorLegendText}>Brazo Der</Text></View>
              <View style={styles.colorLegendRow}><View style={[styles.colorSwatch,{backgroundColor:'#4CAF50'}]} /><Text style={styles.colorLegendText}>Pierna Izq</Text></View>
              <View style={styles.colorLegendRow}><View style={[styles.colorSwatch,{backgroundColor:'#2196F3'}]} /><Text style={styles.colorLegendText}>Pierna Der</Text></View>
              <View style={styles.colorLegendRow}><View style={[styles.colorSwatch,{backgroundColor:'#FFFFFF'}]} /><Text style={styles.colorLegendText}>Torso</Text></View>
            </View>
            {!videoError && selectedVideo?.src ? (
              <Video
                ref={videoRef}
                source={selectedVideo.src}
                style={styles.videoPiP}
                rate={1.0}
                volume={0.5}
                resizeMode="contain"
                shouldPlay
                useNativeControls={false}
                isLooping={true}
                onProgress={(e) => {
                  setVideoCurrentTime(e.currentTime);
                }}
                onLoad={() => {
                  console.log("✓ Video PiP cargado:", selectedVideo.name);
                  setVideoLoaded(true);
                  setVideoError(false);
                }}
                onLayout={(e) => {
                  const { x, y, width, height } = e.nativeEvent.layout;
                  // Convertir a coordenadas absolutas respecto al contenedor de pantalla
                  // Para esto, usamos la posición absoluta del PiP container ya definida
                  setVideoLayout({ x: styles.videoPiPContainer.left, y: styles.videoPiPContainer.bottom ? (undefined) : 0, width, height });
                }}
                onLoadStart={() => {
                  console.log("→ Iniciando carga Video PiP:", selectedVideo.name);
                  setVideoError(false);
                }}
                onError={(error) => {
                  console.error("✗ Video PiP error:", error);
                  console.error("  - Video:", selectedVideo.name);
                  console.error("  - Source type:", typeof selectedVideo.src);
                  setVideoError(true);
                  setVideoLoaded(false);
                  setTimeout(() => {
                    Alert.alert(
                      "Error al reproducir video",
                      `El video "${selectedVideo.name}" no se pudo cargar.\n\nPrueba con otro video de la lista.`,
                      [{ text: "OK" }]
                    );
                  }, 100);
                }}
              />
            ) : (
              <View style={styles.videoErrorPlaceholder}>
                <Ionicons name="videocam-off" size={40} color="#666" />
                <Text style={styles.videoErrorPlaceholderText}>Error</Text>
              </View>
            )}
            {!videoError && (
              <>
                <Text style={styles.videoPiPTime}>{Math.floor(videoCurrentTime)}s</Text>
                <Ionicons
                  name="expand"
                  size={20}
                  color="#fff"
                  style={styles.expandIcon}
                />
              </>
            )}
          </TouchableOpacity>
        )}

        {/* ⭐ Modal expandido del video (pantalla completa) */}
        {isVideoExpanded && (
          <Modal
            visible={isVideoExpanded}
            transparent={false}
            animationType="slide"
            onRequestClose={() => setIsVideoExpanded(false)}
          >
            <View style={styles.expandedVideoContainer}>
              {selectedVideo?.src ? (
                <Video
                  ref={videoRef}
                  source={selectedVideo.src}
                  style={styles.expandedVideo}
                  rate={1.0}
                  volume={1.0}
                  resizeMode="contain"
                  shouldPlay
                  useNativeControls={true}
                  isLooping={true}
                  onProgress={(e) => {
                    setVideoCurrentTime(e.currentTime);
                  }}
                  onLoad={() => {
                    console.log("✓ Video expandido cargado:", selectedVideo.name);
                    setVideoLoaded(true);
                    setVideoError(false);
                  }}
                  onLayout={(e) => {
                    const { width, height } = e.nativeEvent.layout;
                    // En modo expandido, el video ocupa el área definida por styles.expandedVideo
                    setVideoLayout({ x: 0, y: (styles.expandedVideoContainer.height ? (styles.expandedVideoContainer.height - height) / 2 : 0), width, height });
                  }}
                  onLoadStart={() => {
                    console.log("→ Iniciando carga Video expandido:", selectedVideo.name);
                    setVideoError(false);
                  }}
                  onError={(error) => {
                    console.error("✗ Video expandido error:", error);
                    console.error("  - Video:", selectedVideo.name);
                    setVideoError(true);
                    setVideoLoaded(false);
                    setTimeout(() => {
                      Alert.alert(
                        "Error al reproducir video",
                        `El video "${selectedVideo.name}" no se pudo cargar en modo expandido.`,
                        [
                          { text: "Cerrar", onPress: () => setIsVideoExpanded(false) },
                          { text: "OK" }
                        ]
                      );
                    }, 100);
                  }}
                />
              ) : (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ color: '#fff' }}>Video source no disponible</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.closeExpandedButton}
                onPress={() => setIsVideoExpanded(false)}
              >
                <Ionicons name="close" size={32} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.expandedVideoTime}>
                {selectedCondition} - {Math.floor(videoCurrentTime)}s
              </Text>
            </View>
          </Modal>
        )}

        {/* Encabezado con botón atrás */}
        <View style={styles.overlayTop}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={async () => {
              await handleExitRecording();
              // Volver a la pantalla correcta según el flujo de entrada
              if (assignedExercises && assignedExercises.length > 0) {
                setStep("select_exercise");
              } else {
                setStep("select_video");
              }
              setSelectedVideo(null);
              setVideoLoaded(false);
              setVideoCurrentTime(0);
              setIsVideoExpanded(false);
            }}
          >
            <Ionicons name="arrow-back" size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Información y cambio de cámara */}
        <View style={styles.overlayTopRight}>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>{selectedCondition}</Text>
          </View>
        </View>

        {/* Botón flip cámara */}
        <View style={styles.overlayBottomRight}>
          <TouchableOpacity
            style={styles.flipButton}
            onPress={() =>
              setFacing((prev) => (prev === "front" ? "back" : "front"))
            }
          >
            <Ionicons name="camera-reverse" size={30} color="#fff" />
          </TouchableOpacity>
          {/* Botón de landmarks removido */}
        </View>

        {/* ⭐ Aviso de falta de movimiento */}
        {noMovementWarning && (
          <View style={styles.noMovementWarning}>
            <Ionicons name="warning" size={24} color="#FFA500" />
            <Text style={styles.noMovementText}>
              No se detecta movimiento
            </Text>
            <Text style={styles.noMovementSubtext}>
              Muévete para continuar
            </Text>
          </View>
        )}

        {/* ⭐ Aviso de error de conexión */}
        {connectionError && (
          <View style={styles.connectionErrorWarning}>
            <Ionicons name="cloud-offline" size={24} color="#fff" />
            <Text style={styles.connectionErrorText}>
              Error de conexión
            </Text>
            <Text style={styles.connectionErrorSubtext}>
              Verifica el servidor
            </Text>
          </View>
        )}

        {/* ⭐ Aviso de error de video */}
        {videoError && (
          <View style={styles.videoErrorWarning}>
            <Ionicons name="videocam-off" size={24} color="#fff" />
            <Text style={styles.videoErrorText}>
              Error al cargar video
            </Text>
          </View>
        )}

        {/* ⭐ Aviso de distancia (demasiado cerca o lejos) - Solo si no hay otros avisos */}
        {distanceWarning && !connectionError && !noMovementWarning && (
          <View style={[
            styles.distanceWarning,
            distanceWarning === 'too_close' ? styles.distanceWarningClose : styles.distanceWarningFar
          ]}>
            <Ionicons 
              name={distanceWarning === 'too_close' ? "remove-circle" : "expand"} 
              size={24} 
              color="#fff" 
            />
            <Text style={styles.distanceWarningText}>
              {distanceWarning === 'too_close' 
                ? "Demasiado cerca" 
                : "Demasiado lejos"}
            </Text>
            <Text style={styles.distanceWarningSubtext}>
              {distanceWarning === 'too_close'
                ? "Aléjate de la cámara"
                : "Acércate (1.5-3m)"}
            </Text>
          </View>
        )}

        {/* ⭐ Mensaje de distancia óptima */}
        {showOptimalDistance && !distanceWarning && !connectionError && !noMovementWarning && !videoError && (
          <View style={styles.optimalDistanceBanner}>
            <Ionicons name="body" size={24} color="#fff" />
            <View style={{ marginLeft: 10 }}>
              <Text style={styles.optimalDistanceTitle}>Distancia óptima</Text>
              <Text style={styles.optimalDistanceText}>Mantente entre 1.5 y 3 metros para mejor evaluación.</Text>
            </View>
          </View>
        )}

        {/* Feedback flotante - FEEDBACK VISUAL MEJORADO */}
        {showFeedback && (
          <View
            style={[
              styles.feedbackContainer,
              {
                backgroundColor:
                  mensajePostura.includes("Bien") || mensajePostura.includes("✓")
                    ? "rgba(76, 175, 80, 0.95)"
                    : "rgba(255, 107, 107, 0.95)",
              },
            ]}
          >
            {/* Emoji indicador */}
            <Text style={styles.feedbackEmoji}>
              {mensajePostura.includes("Bien") || mensajePostura.includes("✓") ? "✅" : "❌"}
            </Text>
            
            {/* Texto feedback */}
            <Text style={styles.feedbackText}>{mensajePostura}</Text>
            
            {/* Métricas opcionales */}
            {metrics && (metrics.avg_distance || metrics.max_distance) && (
              <Text style={styles.metricsText}>
                Distancia: {metrics.avg_distance?.toFixed(3) || "—"}
              </Text>
            )}
          </View>
        )}

        {/* Indicador de evaluación */}
        {isEvaluating && (
          <View style={{
            position: 'absolute',
            top: 20,
            right: 20,
            zIndex: 99,
            backgroundColor: 'rgba(0,0,0,0.5)',
            borderRadius: 20,
            padding: 8,
            flexDirection: 'row',
            alignItems: 'center',
          }}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={{ color: '#fff', marginLeft: 8, fontSize: 14 }}>Procesando...</Text>
          </View>
        )}

        {/* ⭐ Contador de repeticiones flotante */}
        {sessionStartRef.current && (
          <View style={styles.repsCounter}>
            <View style={styles.repsRow}>
              <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
              <Text style={styles.repsLabel}>Buenas:</Text>
              <Text style={styles.repsValue}>{goodReps}</Text>
            </View>
            <View style={styles.repsRow}>
              <Ionicons name="close-circle" size={18} color="#FF6B6B" />
              <Text style={styles.repsLabel}>Errores:</Text>
              <Text style={styles.repsValue}>{badReps}</Text>
            </View>
            {targetInfoRef.current?.targetReps && (
              <View style={[styles.repsRow, styles.targetRow]}>
                <Ionicons name="flag" size={16} color="#FFC107" />
                <Text style={styles.targetLabel}>Meta: {targetInfoRef.current.targetReps}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  }

  // Nunca pantalla blanca, solo mensaje de carga
  return (
    <View style={styles.centered}>
      <Text style={styles.text}>Cargando...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Selección y preview
  previewContainer: {
    flex: 1,
    backgroundColor: "#f0f3ff",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#4a56a6",
    marginBottom: 20,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#7a8ce2",
    marginBottom: 15,
    textAlign: "center",
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: "#7a8ce2",
  },
  pathologyTag: {
    fontSize: 12,
    color: "#999",
    marginLeft: 15,
    marginTop: 4,
  },
  listContainer: {
    width: "100%",
    maxHeight: 400,
  },
  // Galería de ejercicios estilo fitness app
  exerciseGalleryContainer: {
    flex: 1,
    backgroundColor: "#f0f3ff",
  },
  galleryHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: "#f0f3ff",
  },
  galleryBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#7a8ce2",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 15,
  },
  galleryHeaderText: {
    flex: 1,
  },
  galleryTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#4a56a6",
    letterSpacing: 0.5,
  },
  gallerySubtitle: {
    fontSize: 14,
    color: "#7a8ce2",
    marginTop: 4,
    fontWeight: "600",
  },
  exerciseCardsContainer: {
    padding: 20,
    paddingTop: 10,
  },
  exerciseCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    marginBottom: 20,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#4a56a6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e7ff",
  },
  exerciseCardImageContainer: {
    width: "100%",
    height: 200,
    position: "relative",
  },
  exerciseCardVideo: {
    width: "100%",
    height: "100%",
  },
  exerciseCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(74, 86, 166, 0.2)",
  },
  exerciseCardBadges: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    gap: 8,
  },
  levelBadge: {
    backgroundColor: "#7a8ce2",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  levelBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  exerciseCardContent: {
    padding: 16,
  },
  exerciseCardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#4a56a6",
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  exerciseDetailsContainer: {
    gap: 8,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#7a8ce2",
    minWidth: 90,
  },
  detailValue: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "600",
    flex: 1,
  },
  conditionButton: {
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginVertical: 8,
    borderRadius: 12,
    borderLeftWidth: 5,
    borderLeftColor: "#7a8ce2",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 2,
  },
  conditionButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#4a56a6",
  },
  videoButton: {
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginVertical: 8,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  videoButtonText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#555",
    marginLeft: 15,
    flex: 1,
  },
  backBtn: {
    marginTop: 30,
    backgroundColor: "transparent",
  },
  backText: {
    color: "#7a8ce2",
    fontWeight: "700",
    fontSize: 16,
  },

  // Cámara
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  camera: {
    flex: 1,
  },
  // ⭐ Overlay de landmarks de referencia
  // landmarkDot removido
  // ⭐ Video PiP (Picture-in-Picture) - Compacto en esquina inferior izquierda (responsivo)
  videoPiPContainer: {
    position: "absolute",
    bottom: 20,
    left: 20,
    width: 120,
    height: 160,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#7a8ce2",
    backgroundColor: "#000",
    zIndex: 10,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 10,
  },
  videoPiP: {
    width: "100%",
    height: "100%",
    backgroundColor: "#000",
  },
  videoErrorPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#1a1a1a",
    justifyContent: "center",
    alignItems: "center",
  },
  videoErrorPlaceholderText: {
    color: "#666",
    fontSize: 12,
    marginTop: 8,
    fontWeight: "600",
  },
  videoPiPTime: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.8)",
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  expandIcon: {
    position: "absolute",
    top: 8,
    right: 8,
  },
  // ⭐ Video expandido (pantalla completa)
  expandedVideoContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  expandedVideo: {
    width: "100%",
    height: "80%",
  },
  closeExpandedButton: {
    position: "absolute",
    top: 50,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: 10,
    borderRadius: 30,
    zIndex: 100,
  },
  expandedVideoTime: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.8)",
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    padding: 12,
    borderRadius: 8,
    textAlign: "center",
  },
  overlayTop: {
    position: "absolute",
    top: 50,
    left: 20,
    zIndex: 40,
    elevation: 40,
  },
  backButton: {
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 10,
    borderRadius: 50,
  },
  overlayTopRight: {
    position: "absolute",
    top: 60,
    right: 20,
    maxWidth: 150,
  },
  infoBox: {
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#7a8ce2",
  },
  infoText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  videoNameText: {
    color: "#7a8ce2",
    fontSize: 12,
    fontWeight: "500",
  },

  // Botón flip
  overlayBottomRight: {
    position: "absolute",
    bottom: 20,
    right: 30,
  },
  flipButton: {
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 12,
    borderRadius: 50,
  },

  // Feedback - Compacto y bien posicionado
  feedbackContainer: {
    position: "absolute",
    bottom: 200,
    alignSelf: "center",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
    minWidth: 140,
    maxWidth: "75%",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 10,
  },
  feedbackEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  feedbackText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
    textAlign: "center",
    letterSpacing: 0.3,
  },
  metricsText: {
    color: "#fff",
    fontSize: 12,
    marginTop: 6,
    textAlign: "center",
    opacity: 0.9,
    fontWeight: "600",
  },

  // ⭐ Aviso de falta de movimiento - Compacto
  noMovementWarning: {
    position: "absolute",
    top: 100,
    alignSelf: "center",
    backgroundColor: "rgba(255, 165, 0, 0.95)",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    minWidth: 200,
    maxWidth: "80%",
    zIndex: 50,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 15,
    borderWidth: 2,
    borderColor: "#FF8C00",
  },
  noMovementText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
    marginTop: 4,
    textAlign: "center",
  },
  noMovementSubtext: {
    color: "#fff",
    fontSize: 12,
    marginTop: 2,
    textAlign: "center",
    opacity: 0.9,
  },

  // ⭐ Aviso de distancia - Compacto (posicionado más abajo para no sobreponerse)
  distanceWarning: {
    position: "absolute",
    top: 160,
    alignSelf: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    minWidth: 200,
    maxWidth: "80%",
    zIndex: 50,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 15,
    borderWidth: 2,
  },
  distanceWarningClose: {
    backgroundColor: "rgba(255, 87, 34, 0.95)", // Naranja rojizo para "muy cerca"
    borderColor: "#FF5722",
  },
  distanceWarningFar: {
    backgroundColor: "rgba(33, 150, 243, 0.95)", // Azul para "muy lejos"
    borderColor: "#2196F3",
  },
  distanceWarningText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
    marginTop: 4,
    textAlign: "center",
  },
  distanceWarningSubtext: {
    color: "#fff",
    fontSize: 12,
    marginTop: 2,
    textAlign: "center",
    opacity: 0.95,
    lineHeight: 16,
  },

  // ⭐ Aviso de error de conexión - Compacto (prioridad alta, arriba)
  connectionErrorWarning: {
    position: "absolute",
    top: 100,
    alignSelf: "center",
    backgroundColor: "rgba(244, 67, 54, 0.95)", // Rojo para error
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    minWidth: 200,
    maxWidth: "80%",
    zIndex: 60,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 15,
    borderWidth: 2,
    borderColor: "#D32F2F",
  },
  connectionErrorText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
    marginTop: 4,
    textAlign: "center",
  },
  connectionErrorSubtext: {
    color: "#fff",
    fontSize: 12,
    marginTop: 2,
    textAlign: "center",
    opacity: 0.95,
    lineHeight: 16,
  },

  // ⭐ Aviso de error de video
  videoErrorWarning: {
    position: "absolute",
    bottom: 310,
    left: 20,
    backgroundColor: "rgba(244, 67, 54, 0.9)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 15,
    borderWidth: 1,
    borderColor: "#D32F2F",
  },
  // ⭐ Distancia óptima banner
  optimalDistanceBanner: {
    position: "absolute",
    top: 160,
    alignSelf: "center",
    backgroundColor: "rgba(76, 175, 80, 0.95)",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    minWidth: 240,
    maxWidth: "85%",
    zIndex: 45,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 12,
    borderWidth: 2,
    borderColor: "#4CAF50",
  },
  optimalDistanceTitle: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
    marginBottom: 4,
  },
  optimalDistanceText: {
    color: "#fff",
    fontSize: 12,
    opacity: 0.9,
    lineHeight: 16,
  },
  videoErrorText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 6,
  },
  // Leyenda de colores (segmentos del cuerpo)
  colorLegend: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  colorLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  colorSwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#222'
  },
  colorLegendText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600'
  },

  // Indicador de evaluación - Discreto en la esquina (arriba a la derecha, no sobre el botón flip)
  evaluatingIndicator: {
    position: "absolute",
    top: 100,
    right: 20,
    backgroundColor: "rgba(122, 140, 226, 0.8)",
    padding: 8,
    borderRadius: 50,
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 30,
  },

  // ⭐ Contador de repeticiones en vivo
  repsCounter: {
    position: "absolute",
    top: 100,
    left: 20,
    backgroundColor: "rgba(0,0,0,0.85)",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    minWidth: 140,
    zIndex: 45,
    borderWidth: 2,
    borderColor: "#7a8ce2",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 10,
  },
  repsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  repsLabel: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 6,
    marginRight: 4,
  },
  repsValue: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
  targetRow: {
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.3)",
  },
  targetLabel: {
    color: "#FFC107",
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 4,
  },

  // Permisos/Errores
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f3ff",
    padding: 20,
  },
  text: {
    fontSize: 18,
    color: "#4a56a6",
    fontWeight: "600",
    textAlign: "center",
  },
  btn: {
    marginTop: 15,
    backgroundColor: "#4a56a6",
    paddingVertical: 10,
    paddingHorizontal: 25,
    borderRadius: 10,
  },
  btnText: {
    color: "#fff",
    fontWeight: "600",
  },
});
