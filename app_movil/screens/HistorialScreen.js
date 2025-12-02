import { useState, useEffect } from "react";
import {
  Dimensions,
  FlatList,
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
  ActivityIndicator,
} from "react-native";
import * as Progress from "react-native-progress";
import { supabase } from "../supabaseClient";

const { width } = Dimensions.get("window");

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function HistorialScreen({ navigation }) {
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [reportSummary, setReportSummary] = useState(null);
  const [showExercisesDetail, setShowExercisesDetail] = useState(false);

  // Cargar historial desde Supabase
  useEffect(() => {
    loadHistorial();
  }, []);

  const loadHistorial = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Primero buscar el patient_id del usuario
        const { data: patientData } = await supabase
          .from('patients')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (patientData) {
          // ⭐ Cargar desde exercise_progress (tabla granular con good_reps/bad_reps)
          const { data, error } = await supabase
            .from('exercise_progress')
            .select('*')
            .eq('patient_id', patientData.id)
            .order('started_at', { ascending: false })
            .limit(30);

          if (error) {
            console.warn('Error cargando exercise_progress, intentando exercise_history:', error);
            // Fallback a tabla antigua si existe
            const { data: oldData } = await supabase
              .from('exercise_history')
              .select('*')
              .eq('patient_id', patientData.id)
              .order('date_performed', { ascending: false })
              .limit(10);
            
            if (oldData && oldData.length > 0) {
              const transformedData = oldData.map(item => ({
                id: item.id.toString(),
                fecha: new Date(item.date_performed).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }),
                completados: item.status === 'completed' ? 1 : 0,
                total: 1,
                errores: 0,
                repeticiones: item.repetitions || 0,
                omitidos: item.status === 'skipped' ? 1 : 0,
                ejercicios: [],
              }));
              setHistorial(transformedData);
              setLoading(false);
              return;
            }
          }
          
          if (data && data.length > 0) {
            // ⭐ Agrupar por día (started_at) y transformar
            const groupedByDay = {};
            data.forEach(item => {
              const dayKey = new Date(item.started_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
              if (!groupedByDay[dayKey]) {
                groupedByDay[dayKey] = {
                  fecha: dayKey,
                  completados: 0,
                  total: 0,
                  errores: 0,
                  repeticiones: 0,
                  omitidos: 0,
                  ejercicios: [],
                };
              }
              const group = groupedByDay[dayKey];
              group.total += 1;
              if (item.completed) group.completados += 1;
              group.errores += (item.bad_reps || 0);
              group.repeticiones += ((item.good_reps || 0) + (item.bad_reps || 0));
              if ((item.good_reps || 0) === 0 && (item.bad_reps || 0) === 0) group.omitidos += 1;
              group.ejercicios.push({
                nombre: item.exercise_name,
                pathology: item.pathology,
                goodReps: item.good_reps || 0,
                badReps: item.bad_reps || 0,
                targetReps: item.target_reps,
                completado: item.completed,
                duracion: item.duration_seconds,
              });
            });
            
            // Convertir a array con IDs únicos
            const transformedData = Object.keys(groupedByDay).map((key, idx) => ({
              id: idx.toString(),
              ...groupedByDay[key],
            }));
            
            setHistorial(transformedData);

            // ⭐ Construir reporte agregado
            try {
              const totalSessions = data.length;
              const totalGood = data.reduce((a, r) => a + (r.good_reps || 0), 0);
              const totalBad = data.reduce((a, r) => a + (r.bad_reps || 0), 0);
              const totalCompleted = data.reduce((a, r) => a + (r.completed ? 1 : 0), 0);
              const uniqueExercisesMap = new Map();
              const uniquePathologies = new Set();
              const exerciseDetailMap = new Map();
              const allAssignedDays = new Set();
              const daysWithSessions = new Set();

              const dayNamesEs = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

              data.forEach(r => {
                if (r.exercise_id) uniqueExercisesMap.set(r.exercise_id, r.exercise_name);
                if (r.pathology) uniquePathologies.add(r.pathology);
                // Registrar día de sesión
                const d = new Date(r.started_at);
                daysWithSessions.add(dayNamesEs[d.getDay()]);
                // Registrar días asignados
                if (Array.isArray(r.therapist_days)) {
                  r.therapist_days.forEach(dia => allAssignedDays.add(dia));
                }
                // Detalle por ejercicio
                const key = r.exercise_id || r.exercise_name || 'ejercicio';
                if (!exerciseDetailMap.has(key)) {
                  exerciseDetailMap.set(key, {
                    exercise_id: r.exercise_id,
                    name: r.exercise_name,
                    pathology: r.pathology,
                    sessions: 0,
                    totalGood: 0,
                    totalBad: 0,
                    totalCompletedReps: 0,
                    targets: [],
                    completedSessions: 0,
                    durations: [],
                  });
                }
                const ed = exerciseDetailMap.get(key);
                ed.sessions += 1;
                ed.totalGood += (r.good_reps || 0);
                ed.totalBad += (r.bad_reps || 0);
                ed.totalCompletedReps += (r.completed_reps || 0);
                if (r.target_reps || r.target_seconds) {
                  ed.targets.push({ reps: r.target_reps, seconds: r.target_seconds });
                }
                if (r.completed) ed.completedSessions += 1;
                if (r.duration_seconds) ed.durations.push(r.duration_seconds);
              });

              const exerciseDetails = Array.from(exerciseDetailMap.values()).map(ed => {
                const attempts = ed.sessions;
                const accuracy = (ed.totalGood + ed.totalBad) > 0 ? ed.totalGood / (ed.totalGood + ed.totalBad) : 0;
                const avgDuration = ed.durations.length > 0 ? Math.round(ed.durations.reduce((a,b)=>a+b,0)/ed.durations.length) : null;
                // Meta estimada (si múltiples, tomar la más frecuente de reps)
                let targetReps = null;
                if (ed.targets.length > 0) {
                  const freq = {};
                  ed.targets.forEach(t => { if (t.reps) freq[t.reps] = (freq[t.reps] || 0) + 1; });
                  targetReps = Object.entries(freq).sort((a,b)=>b[1]-a[1])[0]?.[0] || ed.targets[0].reps;
                }
                return {
                  name: ed.name,
                  pathology: ed.pathology,
                  sessions: attempts,
                  totalGood: ed.totalGood,
                  totalBad: ed.totalBad,
                  accuracy,
                  completedSessions: ed.completedSessions,
                  totalCompletedReps: ed.totalCompletedReps,
                  targetReps,
                  avgDuration,
                };
              });

              // Adherencia a días asignados
              const assignedDaysArr = Array.from(allAssignedDays);
              const sessionDaysArr = Array.from(daysWithSessions);
              const adherence = assignedDaysArr.length > 0 ? (assignedDaysArr.filter(d => daysWithSessions.has(d)).length / assignedDaysArr.length) : null;

              setReportSummary({
                totalSessions,
                totalGood,
                totalBad,
                totalCompleted,
                totalExercises: uniqueExercisesMap.size,
                pathologiesCount: uniquePathologies.size,
                accuracyGlobal: (totalGood + totalBad) > 0 ? totalGood / (totalGood + totalBad) : 0,
                assignedDays: assignedDaysArr,
                sessionDays: sessionDaysArr,
                adherence,
                exerciseDetails,
              });
            } catch (e) {
              console.log('Error construyendo reporte:', e.message);
            }
          } else {
            // Si no hay datos, usar ejemplo
            setHistorial([
              { id: "1", fecha: "10 Oct 2025", completados: 5, total: 5, errores: 0, repeticiones: 15, omitidos: 0, ejercicios: [] },
              { id: "2", fecha: "9 Oct 2025", completados: 4, total: 5, errores: 2, repeticiones: 12, omitidos: 1, ejercicios: [] },
              { id: "3", fecha: "8 Oct 2025", completados: 3, total: 5, errores: 3, repeticiones: 10, omitidos: 2, ejercicios: [] },
              { id: "4", fecha: "7 Oct 2025", completados: 5, total: 5, errores: 1, repeticiones: 15, omitidos: 0, ejercicios: [] },
            ]);
          }
        } else {
          // No hay paciente asociado, usar datos de ejemplo
          setHistorial([
            { id: "1", fecha: "10 Oct 2025", completados: 5, total: 5, errores: 0, repeticiones: 15, omitidos: 0, ejercicios: [] },
            { id: "2", fecha: "9 Oct 2025", completados: 4, total: 5, errores: 2, repeticiones: 12, omitidos: 1, ejercicios: [] },
            { id: "3", fecha: "8 Oct 2025", completados: 3, total: 5, errores: 3, repeticiones: 10, omitidos: 2, ejercicios: [] },
            { id: "4", fecha: "7 Oct 2025", completados: 5, total: 5, errores: 1, repeticiones: 15, omitidos: 0, ejercicios: [] },
          ]);
        }
      } else {
        // Usuario no autenticado, usar datos de ejemplo
        setHistorial([
          { id: "1", fecha: "10 Oct 2025", completados: 5, total: 5, errores: 0, repeticiones: 15, omitidos: 0, ejercicios: [] },
          { id: "2", fecha: "9 Oct 2025", completados: 4, total: 5, errores: 2, repeticiones: 12, omitidos: 1, ejercicios: [] },
          { id: "3", fecha: "8 Oct 2025", completados: 3, total: 5, errores: 3, repeticiones: 10, omitidos: 2, ejercicios: [] },
          { id: "4", fecha: "7 Oct 2025", completados: 5, total: 5, errores: 1, repeticiones: 15, omitidos: 0, ejercicios: [] },
        ]);
      }
    } catch (error) {
      console.error('Error cargando historial:', error);
      // Usar datos de ejemplo en caso de error
      setHistorial([
        { id: "1", fecha: "10 Oct 2025", completados: 5, total: 5, errores: 0, repeticiones: 15, omitidos: 0, ejercicios: [] },
        { id: "2", fecha: "9 Oct 2025", completados: 4, total: 5, errores: 2, repeticiones: 12, omitidos: 1, ejercicios: [] },
        { id: "3", fecha: "8 Oct 2025", completados: 3, total: 5, errores: 3, repeticiones: 10, omitidos: 2, ejercicios: [] },
        { id: "4", fecha: "7 Oct 2025", completados: 5, total: 5, errores: 1, repeticiones: 15, omitidos: 0, ejercicios: [] },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const promedio =
    historial.reduce((acc, d) => acc + d.completados / d.total, 0) / historial.length;

  const toggleExpand = (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);
  };

  const renderHeader = () => (
    <View>
      <Text style={styles.title}>📈 Tu progreso</Text>
      <Text style={styles.subtitle}>Reporte detallado de tus sesiones</Text>

      {!loading && (
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>Promedio de avance</Text>
          <Progress.Circle
            progress={promedio}
            size={width * 0.5}
            color="#7a8ce2"
            unfilledColor="#dbeafe"
            borderWidth={0}
            showsText={true}
            formatText={() => `${Math.round(promedio * 100)}%`}
          />
        </View>
      )}

      {reportSummary && (
        <View style={styles.reportCard}>
          <Text style={styles.reportTitle}>📊 Resumen semanal</Text>
          <View style={styles.reportRowWrap}>
            <View style={styles.reportItem}><Text style={styles.reportLabel}>Sesiones:</Text><Text style={styles.reportValue}>{reportSummary.totalSessions}</Text></View>
            <View style={styles.reportItem}><Text style={styles.reportLabel}>Ejercicios:</Text><Text style={styles.reportValue}>{reportSummary.totalExercises}</Text></View>
            <View style={styles.reportItem}><Text style={styles.reportLabel}>Buenos:</Text><Text style={styles.reportValueSuccess}>{reportSummary.totalGood}</Text></View>
            <View style={styles.reportItem}><Text style={styles.reportLabel}>Errores:</Text><Text style={styles.reportValueError}>{reportSummary.totalBad}</Text></View>
            <View style={styles.reportItem}><Text style={styles.reportLabel}>Completados:</Text><Text style={styles.reportValue}>{reportSummary.totalCompleted}</Text></View>
            <View style={styles.reportItem}><Text style={styles.reportLabel}>Precisión:</Text><Text style={styles.reportValue}>{Math.round(reportSummary.accuracyGlobal * 100)}%</Text></View>
          </View>
          {/* Calendario de adherencia semanal */}
          <View style={styles.weekGrid}>
            {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d => {
              const asignado = reportSummary.assignedDays?.includes(d);
              const hecho = reportSummary.sessionDays?.includes(d);
              return (
                <View key={d} style={[styles.weekCell, asignado && styles.weekCellAssigned, hecho && styles.weekCellDone]}>
                  <Text style={styles.weekCellText}>{d}</Text>
                </View>
              );
            })}
          </View>
          {reportSummary.assignedDays && reportSummary.assignedDays.length > 0 && (
            <View style={styles.adherenceContainer}>
              <Text style={styles.adherenceTitle}>🗓 Adherencia a días asignados</Text>
              <Text style={styles.adherenceText}>Asignados: {reportSummary.assignedDays.join(', ')}</Text>
              <Text style={styles.adherenceText}>Con sesiones: {reportSummary.sessionDays.join(', ') || '—'}</Text>
              <Text style={styles.adherencePercent}>Adherencia: {reportSummary.adherence !== null ? Math.round(reportSummary.adherence * 100) + '%' : '—'}</Text>
            </View>
          )}
          <TouchableOpacity style={styles.detailToggleBtn} onPress={() => setShowExercisesDetail(p => !p)}>
            <Text style={styles.detailToggleText}>{showExercisesDetail ? 'Ocultar detalle' : 'Ver detalle por ejercicio'}</Text>
          </TouchableOpacity>
          {showExercisesDetail && (
            <View style={styles.exerciseDetailsContainerReport}>
              {reportSummary.exerciseDetails.map((ex, idx) => (
                <View style={styles.exerciseDetailRow} key={idx}>
                  <Text style={styles.exerciseDetailName}>{ex.name}{ex.targetReps ? ` (Meta ${ex.targetReps})` : ''}</Text>
                  <View style={styles.exerciseDetailStatsLine}>
                    <Text style={styles.exerciseDetailStat}>Ses: {ex.sessions}</Text>
                    <Text style={styles.exerciseDetailStat}>✓ {ex.totalGood}</Text>
                    <Text style={styles.exerciseDetailStatErr}>✗ {ex.totalBad}</Text>
                    <Text style={styles.exerciseDetailStat}>Precisión {Math.round(ex.accuracy*100)}%</Text>
                    <Text style={styles.exerciseDetailStat}>Comp {ex.completedSessions}</Text>
                    {ex.avgDuration && <Text style={styles.exerciseDetailStat}>⏱ {Math.floor(ex.avgDuration/60)}:{(ex.avgDuration%60).toString().padStart(2,'0')}</Text>}
                  </View>
                  {/* Barra de progreso hacia meta de repeticiones si existe */}
                  {ex.targetReps && (
                    <View style={styles.exerciseProgressBarWrapper}>
                      <View style={styles.exerciseProgressMetaRow}>
                        <Text style={styles.exerciseProgressMetaText}>Meta: {ex.targetReps}</Text>
                        <Text style={styles.exerciseProgressMetaText}>Realizadas: {ex.totalGood + ex.totalBad}</Text>
                      </View>
                      <View style={styles.exerciseProgressBarBg}>
                        <View style={[styles.exerciseProgressBarGood,{ width: `${Math.min(100,(ex.totalGood/ex.targetReps)*100)}%` }]} />
                        <View style={[styles.exerciseProgressBarBad,{ width: `${Math.min(100,(ex.totalBad/ex.targetReps)*100)}%` }]} />
                      </View>
                    </View>
                  )}
                </View>
              ))}
              {/* Indicador global de rutina completada (porcentaje ejercicios con sesiones ≥1) */}
              <View style={styles.routineCompletionBox}>
                <Text style={styles.routineCompletionTitle}>Estado de rutina</Text>
                <Text style={styles.routineCompletionValue}>{Math.round((reportSummary.exerciseDetails.filter(e=>e.sessions>0 && (!e.targetReps || e.totalGood>=e.targetReps)).length / reportSummary.exerciseDetails.length) * 100)}% completada</Text>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );

  const renderFooter = () => (
    <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
      <Text style={styles.buttonText}>⬅ Volver</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#7a8ce2" />
        <Text style={styles.loadingText}>Cargando historial...</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={historial}
      keyExtractor={(item) => item.id.toString()}
      ListHeaderComponent={renderHeader}
      ListFooterComponent={renderFooter}
      contentContainerStyle={styles.listContainer}
      renderItem={({ item }) => (
        <TouchableOpacity onPress={() => toggleExpand(item.id)}>
          <View style={styles.card}>
            <Text style={styles.date}>{item.fecha}</Text>
            <Progress.Bar
              progress={item.completados / item.total}
              width={width * 0.8}
              height={12}
              color="#7a8ce2"
              unfilledColor="#dbeafe"
              borderWidth={0}
              borderRadius={10}
            />
            <Text style={styles.status}>
              {item.completados}/{item.total} completados
            </Text>

            {expandedId === item.id && (
              <View style={styles.details}>
                <Text style={styles.detailText}>🔁 Repeticiones totales: {item.repeticiones}</Text>
                <Text style={styles.detailText}>⚠️ Errores: {item.errores}</Text>
                <Text style={styles.detailText}>🚫 Ejercicios omitidos: {item.omitidos}</Text>
                
                {item.ejercicios && item.ejercicios.length > 0 && (
                  <View style={styles.exerciseList}>
                    <Text style={styles.exerciseListTitle}>📋 Ejercicios realizados:</Text>
                    {item.ejercicios.map((ej, idx) => (
                      <View key={idx} style={styles.exerciseItem}>
                        <Text style={styles.exerciseItemName}>
                          {ej.nombre}
                          {ej.completado && <Text style={{color: '#4CAF50'}}> ✓</Text>}
                        </Text>
                        <View style={styles.exerciseItemStats}>
                          <Text style={styles.exerciseItemGood}>✓ {ej.goodReps}</Text>
                          <Text style={styles.exerciseItemBad}>✗ {ej.badReps}</Text>
                          {ej.targetReps && (
                            <Text style={styles.exerciseItemTarget}>Meta: {ej.targetReps}</Text>
                          )}
                        </View>
                        {ej.duracion && (
                          <Text style={styles.exerciseItemDuration}>⏱ {Math.floor(ej.duracion/60)}:{(ej.duracion%60).toString().padStart(2,'0')}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f3ff",
    paddingTop: 60, // 🧩 margen superior visualmente correcto
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#4a56a6",
    textAlign: "center",
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: "#555",
    textAlign: "center",
    marginBottom: 25,
  },
  progressContainer: {
    alignItems: "center",
    marginBottom: 30,
  },
  progressText: {
    fontWeight: "700",
    color: "#4a56a6",
    marginBottom: 15,
    fontSize: 16,
  },
  listContainer: {
    alignItems: "center",
    paddingBottom: 30,
  },
  card: {
    backgroundColor: "#fff",
    width: width * 0.9, // ocupa casi todo el ancho
    padding: 18,
    borderRadius: 15,
    marginBottom: 16,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 3 },
    alignItems: "center",
  },
  date: {
    fontSize: 17,
    fontWeight: "700",
    color: "#4a56a6",
    marginBottom: 10,
  },
  status: {
    fontSize: 14,
    color: "#555",
    marginTop: 8,
  },
  details: {
    marginTop: 12,
    backgroundColor: "#eef2ff",
    padding: 10,
    borderRadius: 10,
    width: "100%",
  },
  detailText: {
    color: "#333",
    fontSize: 14,
    marginVertical: 2,
  },
  exerciseList: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#d0d5ff",
  },
  exerciseListTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4a56a6",
    marginBottom: 6,
  },
  exerciseItem: {
    backgroundColor: "#fff",
    padding: 8,
    borderRadius: 8,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: "#7a8ce2",
  },
  exerciseItemName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  exerciseItemStats: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  exerciseItemGood: {
    fontSize: 12,
    color: "#4CAF50",
    fontWeight: "700",
  },
  exerciseItemBad: {
    fontSize: 12,
    color: "#FF6B6B",
    fontWeight: "700",
  },
  exerciseItemTarget: {
    fontSize: 11,
    color: "#FFC107",
    fontWeight: "600",
  },
  exerciseItemDuration: {
    fontSize: 11,
    color: "#666",
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 50,
  },
  loadingText: {
    marginTop: 10,
    color: "#7a8ce2",
    fontSize: 16,
  },
  button: {
    backgroundColor: "#7a8ce2",
    alignSelf: "center",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
    marginVertical: 30,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  // Reporte agregado estilos
  reportCard: {
    backgroundColor: '#ffffff',
    padding: 18,
    borderRadius: 16,
    width: width * 0.92,
    alignSelf: 'center',
    marginBottom: 28,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width:0, height:4 },
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e3e8ff'
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4a56a6',
    marginBottom: 12,
  },
  reportRowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  reportItem: {
    width: (width * 0.92 - 18*2 - 12*2)/3, // 3 por fila aproximadamente
    backgroundColor: '#f5f7ff',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  reportLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b78b8',
  },
  reportValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2d3a73',
  },
  reportValueSuccess: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4CAF50',
  },
  reportValueError: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF6B6B',
  },
  adherenceContainer: {
    backgroundColor: '#eef2ff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  adherenceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4a56a6',
    marginBottom: 6,
  },
  adherenceText: {
    fontSize: 12,
    color: '#334155',
  },
  adherencePercent: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
    color: '#4a56a6'
  },
  detailToggleBtn: {
    backgroundColor: '#7a8ce2',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 10,
  },
  detailToggleText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  exerciseDetailsContainerReport: {
    marginTop: 4,
    gap: 14,
  },
  exerciseDetailRow: {
    backgroundColor: '#f8f9ff',
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#7a8ce2',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width:0, height:2 },
    shadowRadius: 4,
    elevation: 2,
  },
  exerciseDetailName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#283b75',
    marginBottom: 6,
  },
  exerciseDetailStatsLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  exerciseDetailStat: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
    backgroundColor: '#e9edff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  exerciseDetailStatErr: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  exerciseProgressBarWrapper: {
    marginTop: 4,
  },
  exerciseProgressMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  exerciseProgressMetaText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  exerciseProgressBarBg: {
    flexDirection: 'row',
    height: 12,
    backgroundColor: '#dde3f9',
    borderRadius: 8,
    overflow: 'hidden',
  },
  exerciseProgressBarGood: {
    backgroundColor: '#4CAF50',
    height: '100%',
  },
  exerciseProgressBarBad: {
    backgroundColor: '#FF6B6B',
    height: '100%',
  },
  routineCompletionBox: {
    marginTop: 10,
    backgroundColor: '#eef6ff',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c7dcff',
    alignItems: 'center'
  },
  routineCompletionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#264b87',
    marginBottom: 4,
  },
  routineCompletionValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  weekGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 4,
  },
  weekCell: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f1f5ff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d5ddf3',
  },
  weekCellAssigned: {
    borderColor: '#7a8ce2',
  },
  weekCellDone: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  weekCellText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155'
  },
});
