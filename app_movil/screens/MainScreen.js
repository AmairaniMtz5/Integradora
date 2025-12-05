import { Video } from "expo-av";
import { useRef, useState, useEffect } from "react";
import {
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import * as Progress from "react-native-progress";
import { supabase } from "../supabaseClient";

export default function MainScreen({ navigation }) {
  const [completed, setCompleted] = useState(2);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [patientName, setPatientName] = useState("Paciente");
  const [patientPhoto, setPatientPhoto] = useState(null);
  const [patientCondition, setPatientCondition] = useState("Escoliosis Idiopática");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const videoRef = useRef(null);
  const total = 8;
  const progress = completed / total;

  useEffect(() => {
    loadPatientProfile();
    loadUnreadMessages();
    
    // Actualizar contador cada 30 segundos
    const interval = setInterval(loadUnreadMessages, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadPatientProfile = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.log('Usuario no autenticado');
        setLoadingProfile(false);
        return;
      }

      console.log('Usuario autenticado:', user.id, user.email);

      const { data: patient, error: patientError } = await supabase
        .from('patients')
        .select('first_name, last_name, profile_photo_url, medical_history')
        .eq('user_id', user.id)
        .maybeSingle();

      if (patientError) {
        console.log('Error cargando perfil:', patientError);
      } else if (patient) {
        console.log('Paciente encontrado:', patient);
        const fullName = `${patient.first_name || ''} ${patient.last_name || ''}`.trim();
        setPatientName(fullName || 'Paciente');
        console.log('URL de foto:', patient.profile_photo_url);
        setPatientPhoto(patient.profile_photo_url || null);
        setPatientCondition(patient.medical_history || 'Escoliosis Idiopática');
      } else {
        console.log('No se encontró paciente para user_id:', user.id);
        // Buscar si existe el paciente por email como fallback
        const { data: patientByEmail } = await supabase
          .from('patients')
          .select('first_name, last_name, profile_photo_url, medical_history, user_id')
          .eq('email', user.email)
          .maybeSingle();
        
        if (patientByEmail) {
          console.log('Paciente encontrado por email:', patientByEmail);
          const fullName = `${patientByEmail.first_name || ''} ${patientByEmail.last_name || ''}`.trim();
          setPatientName(fullName || 'Paciente');
          setPatientPhoto(patientByEmail.profile_photo_url || null);
          setPatientCondition(patientByEmail.medical_history || 'Escoliosis Idiopática');
          
          // Si el paciente no tiene user_id, actualizarlo
          if (!patientByEmail.user_id) {
            console.log('Vinculando paciente con usuario...');
            await supabase
              .from('patients')
              .update({ user_id: user.id })
              .eq('email', user.email);
          }
        }
      }
    } catch (err) {
      console.error('Error en loadPatientProfile:', err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const loadUnreadMessages = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: patient } = await supabase
        .from('patients')
        .select('therapist_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!patient || !patient.therapist_id) return;

      const { data: therapistUser } = await supabase
        .from('users')
        .select('id')
        .eq('id', patient.therapist_id)
        .single();

      if (!therapistUser) return;

      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('sender_id', therapistUser.id)
        .eq('receiver_id', user.id)
        .eq('read', false)
        .eq('deleted_by_receiver', false);

      setUnreadMessages(count || 0);
    } catch (err) {
      console.error('Error cargando mensajes no leídos:', err);
    }
  };

  const tarjetasActividades = [
    {
      id: "1",
      titulo: "Registro de progreso",
      horario: "Ver tu evolución",
      progreso: completed / total * 100,
      icono: "📈",
      color: "#7a8ce2",
      isProgreso: true,
    },
    {
      id: "2",
      titulo: "Imitar",
      subtitulo: "Videos",
      icono: "🎥",
      color: "#A8D8FF",
      isMenu: true,
      action: "VideoRef",
    },
    {
      id: "3",
      titulo: "Chat",
      subtitulo: "Contacto",
      icono: "💬",
      color: "#E9D5FF",
      isMenu: true,
      action: "Contacto",
    },
    {
      id: "4",
      titulo: "Perfil",
      subtitulo: "Tu información",
      icono: "👤",
      color: "#FFE5E5",
      isMenu: true,
      action: "Perfil",
    },
    {
      id: "5",
      titulo: "Cerrar sesión",
      subtitulo: "Salir",
      icono: "🚪",
      color: "#C8F5D4",
      isMenu: true,
      action: "Login",
    },
  ];

  const defaultImage = require("../assets/stretch.png");

  const handleContinue = () => {
    if (videoRef.current) {
      videoRef.current.pauseAsync();
    }
    navigation.navigate("Camera", {
      ejercicio: selectedExercise.titulo,
      reps: selectedExercise.horario,
    });
    setSelectedExercise(null);
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.profileHeader}>
        <View style={styles.profileHeaderLeft}>
          <Text style={styles.title}>Hola, {patientName} 👋</Text>
          <Text style={styles.subtitle}>Ejercicios para {patientCondition}:</Text>
        </View>
        {patientPhoto ? (
          <Image 
            source={{ uri: patientPhoto }} 
            style={styles.profilePhoto}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.profilePhotoPlaceholder}>
            <Text style={styles.profilePhotoText}>
              {patientName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>
    </View>
  );



  return (
    <View style={styles.container}>
      {loadingProfile ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7a8ce2" />
          <Text style={styles.loadingText}>Cargando perfil...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {renderHeader()}
          
          {/* Tarjeta de Progreso - Ancho completo */}
            <TouchableOpacity
              style={[styles.activityCard, styles.fullWidthCard, { backgroundColor: tarjetasActividades[0].color }]}
              onPress={() => navigation.navigate("Historial")}
            >
              <View style={styles.activityContent}>
                <View style={styles.activityLeft}>
                  <View style={styles.progressCircle}>
                    <Text style={styles.progressText}>{Math.round(tarjetasActividades[0].progreso)}%</Text>
                  </View>
                </View>
                <View style={styles.activityRight}>
                  <Text style={styles.activityIcon}>{tarjetasActividades[0].icono}</Text>
                </View>
              </View>
              <Text style={styles.activityTitle}>{tarjetasActividades[0].titulo}</Text>
              <Text style={styles.activityTime}>{tarjetasActividades[0].horario}</Text>
            </TouchableOpacity>

            {/* Fila 1: Imitar y Chat */}
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.activityCard, styles.halfCard, { backgroundColor: tarjetasActividades[1].color }]}
                onPress={() => navigation.navigate(tarjetasActividades[1].action)}
              >
                <View style={styles.menuCardContent}>
                  <Text style={styles.menuIcon}>{tarjetasActividades[1].icono}</Text>
                </View>
                <Text style={styles.menuTitle}>{tarjetasActividades[1].titulo}</Text>
                <Text style={styles.menuSubtitle}>{tarjetasActividades[1].subtitulo}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.activityCard, styles.halfCard, { backgroundColor: tarjetasActividades[2].color }]}
                onPress={() => navigation.navigate(tarjetasActividades[2].action)}
              >
                <View style={styles.menuCardContent}>
                  <Text style={styles.menuIcon}>{tarjetasActividades[2].icono}</Text>
                  {unreadMessages > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{unreadMessages}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.menuTitle}>{tarjetasActividades[2].titulo}</Text>
                <Text style={styles.menuSubtitle}>{tarjetasActividades[2].subtitulo}</Text>
              </TouchableOpacity>
            </View>

            {/* Fila 2: Perfil y Cerrar sesión */}
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.activityCard, styles.halfCard, { backgroundColor: tarjetasActividades[3].color }]}
                onPress={() => navigation.navigate(tarjetasActividades[3].action)}
              >
                <View style={styles.menuCardContent}>
                  <Text style={styles.menuIcon}>{tarjetasActividades[3].icono}</Text>
                </View>
                <Text style={styles.menuTitle}>{tarjetasActividades[3].titulo}</Text>
                <Text style={styles.menuSubtitle}>{tarjetasActividades[3].subtitulo}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.activityCard, styles.halfCard, { backgroundColor: tarjetasActividades[4].color }]}
                onPress={async () => {
                  try {
                    await supabase.auth.signOut();
                  } catch (e) {
                    console.log('Error al cerrar sesión:', e);
                  } finally {
                    navigation.replace(tarjetasActividades[4].action);
                  }
                }}
              >
                <View style={styles.menuCardContent}>
                  <Text style={styles.menuIcon}>{tarjetasActividades[4].icono}</Text>
                </View>
                <Text style={styles.menuTitle}>{tarjetasActividades[4].titulo}</Text>
                <Text style={styles.menuSubtitle}>{tarjetasActividades[4].subtitulo}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
      )}

      {/* Modal de introducción con video */}
      {selectedExercise && (
        <Modal
          transparent={true}
          animationType="slide"
          visible={true}
          onRequestClose={() => setSelectedExercise(null)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{selectedExercise.titulo}</Text>
              <View style={[styles.modalIconContainer, { backgroundColor: selectedExercise.color }]}>
                <Text style={styles.modalIcon}>{selectedExercise.icono}</Text>
              </View>
              <Text style={styles.modalTip}>📅 {selectedExercise.horario}</Text>
              <Text style={styles.modalProgress}>Progreso: {Math.round(selectedExercise.progreso)}%</Text>

              <TouchableOpacity
                style={styles.continueBtn}
                onPress={handleContinue}
              >
                <Text style={styles.continueText}>Iniciar actividad ➜</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setSelectedExercise(null)}
              >
                <Text style={styles.closeText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f3ff" },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#7a8ce2',
  },
  header: { marginTop: 60, paddingHorizontal: 20 },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  profileHeaderLeft: {
    flex: 1,
    marginRight: 10,
  },
  profilePhoto: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    borderWidth: 3,
    borderColor: '#7a8ce2',
  },
  profilePhotoPlaceholder: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    backgroundColor: '#7a8ce2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePhotoText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
  },
  title: { fontSize: 24, fontWeight: "800", color: "#4a56a6", marginBottom: 5 },
  subtitle: { fontSize: 16, color: "#555", marginBottom: 20 },
  progressContainer: { alignItems: "center", marginBottom: 25 },
  progressText: { marginBottom: 8, fontWeight: "600", color: "#444" },
  list: { flexGrow: 0, paddingHorizontal: 20, paddingBottom: 30 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#fff",
    padding: 18,
    borderRadius: 15,
    marginBottom: 14,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
  },
  activityCard: {
    borderRadius: 20,
    padding: 20,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    minHeight: 140,
  },
  fullWidthCard: {
    width: '100%',
    marginBottom: 16,
  },
  halfCard: {
    flex: 1,
    marginHorizontal: 6,
  },
  activityContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  activityLeft: {
    flex: 1,
  },
  progressCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  progressText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  activityRight: {
    alignItems: 'flex-end',
  },
  activityIcon: {
    fontSize: 40,
  },
  activityTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
  },
  activityTime: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  menuCardContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  menuIcon: {
    fontSize: 50,
    marginBottom: 5,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  menuSubtitle: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: '#ff4757',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 6,
  },
  exerciseName: { fontSize: 17, fontWeight: "700", color: "#4a56a6" },
  exerciseReps: { fontSize: 14, color: "#666", marginTop: 4 },
  tipText: { fontSize: 13, color: "#7a7a7a", marginTop: 6, fontStyle: "italic" },

  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
    width: "90%",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#4a56a6",
    marginBottom: 10,
    textAlign: "center",
  },
  video: { width: "100%", height: 250, borderRadius: 10, backgroundColor: "#000" },
  image: { width: "100%", height: 250, borderRadius: 10, resizeMode: "contain" },
  modalTip: {
    fontSize: 14,
    color: "#666",
    marginTop: 10,
    textAlign: "center",
  },
  modalIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginVertical: 20,
  },
  modalIcon: {
    fontSize: 50,
  },
  modalProgress: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4a56a6',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  continueBtn: {
    marginTop: 15,
    backgroundColor: "#4a56a6",
    paddingVertical: 10,
    paddingHorizontal: 25,
    borderRadius: 10,
  },
  continueText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  closeBtn: {
    marginTop: 10,
    backgroundColor: "#aaa",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  closeText: { color: "#fff", fontWeight: "600", fontSize: 14 },
});
