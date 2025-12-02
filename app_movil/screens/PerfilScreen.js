import { useNavigation } from "@react-navigation/native";
import { useState, useEffect } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../supabaseClient";

export default function PerfilScreen() {
  const navigation = useNavigation();

  const [nombre, setNombre] = useState("");
  const [edad, setEdad] = useState("");
  const [correo, setCorreo] = useState("");
  const [patologia, setPatologia] = useState("Escoliosis idiopática");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState("");

  const [originalData, setOriginalData] = useState({
    nombre: "",
    edad: "",
    correo: "",
  });

  // Cargar datos del perfil desde Supabase
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setRefreshMessage("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Cargar perfil desde tabla patients por user_id
        let { data, error } = await supabase
          .from('patients')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        // Si no se encuentra por user_id, buscar por email
        if (!data && user.email) {
          const { data: patientByEmail } = await supabase
            .from('patients')
            .select('*')
            .eq('email', user.email)
            .maybeSingle();
          
          if (patientByEmail) {
            data = patientByEmail;
            // Vincular user_id si no existe
            if (!patientByEmail.user_id) {
              await supabase
                .from('patients')
                .update({ user_id: user.id })
                .eq('email', user.email);
            }
          }
        }

        if (error && error.code !== 'PGRST116') throw error;
        
        if (data) {
          const fullName = `${data.first_name || ''} ${data.last_name || ''}`.trim();
          setNombre(fullName || "");
          setEdad(data.age?.toString() || "");
          setCorreo(data.email || user.email || "");
          setPatologia(data.medical_history || "Sin diagnóstico");
          setOriginalData({
            nombre: fullName || "",
            edad: data.age?.toString() || "",
            correo: data.email || user.email || "",
          });
          setRefreshMessage("Perfil actualizado correctamente");
        } else {
          // Si no existe perfil, usar email del usuario autenticado
          setCorreo(user.email || "");
          setOriginalData({
            nombre: "",
            edad: "",
            correo: user.email || "",
          });
        }
      } else {
        // Usuario no autenticado, usar datos de ejemplo
        setNombre("Danae Barqueras");
        setEdad("20");
        setCorreo("danae@physionext.mx");
        setOriginalData({
          nombre: "Danae Barqueras",
          edad: "20",
          correo: "danae@physionext.mx",
        });
      }
    } catch (error) {
      console.error('Error cargando perfil:', error);
      Alert.alert("Error", "No se pudo cargar el perfil");
    } finally {
      setLoading(false);
    }
  };

  const handleGuardar = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Guardar en tabla patients
        const nameParts = nombre.trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        const { error } = await supabase
          .from('patients')
          .upsert({
            user_id: user.id,
            first_name: firstName,
            last_name: lastName,
            age: parseInt(edad) || null,
            email: correo,
            updated_at: new Date().toISOString(),
          });

        if (error) throw error;
        
        setOriginalData({ nombre, edad, correo });
        Alert.alert("✅ Éxito", "Cambios guardados con éxito");
      } else {
        // Sin autenticación, solo actualizar local
        setOriginalData({ nombre, edad, correo });
        Alert.alert("✅ Éxito", "Cambios guardados localmente");
      }
    } catch (error) {
      console.error('Error guardando perfil:', error);
      Alert.alert("Error", "No se pudieron guardar los cambios");
    } finally {
      setSaving(false);
    }
  };

  const handleDescartar = () => {
    setNombre(originalData.nombre);
    setEdad(originalData.edad);
    setCorreo(originalData.correo);
    Alert.alert("ℹ️ Cambios descartados", "Se restauraron los valores anteriores");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Tu Perfil 👤</Text>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#7a8ce2" />
            <Text style={styles.loadingText}>Cargando perfil...</Text>
          </View>
        ) : (
          <>
            {/* Banner informativo: solo admin puede modificar */}
            <View style={styles.infoBanner}>
              <Text style={styles.infoBannerIcon}>ℹ️</Text>
              <View style={{flex:1}}>
                <Text style={styles.infoBannerTitle}>Perfil de solo lectura</Text>
                <Text style={styles.infoBannerText}>
                  Solo el administrador puede modificar tu información. Contacta al equipo médico si necesitas cambios.
                </Text>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>👤 Nombre</Text>
                <Text style={styles.profileValue}>{nombre || '—'}</Text>
              </View>
              <View style={styles.divider} />

              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>🎂 Edad</Text>
                <Text style={styles.profileValue}>{edad ? edad + ' años' : '—'}</Text>
              </View>
              <View style={styles.divider} />

              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>📧 Correo</Text>
                <Text style={[styles.profileValue, styles.profileEmail]}>{correo || '—'}</Text>
              </View>
              <View style={styles.divider} />

              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>🏥 Diagnóstico</Text>
                <View style={styles.diagnosisTag}>
                  <Text style={styles.diagnosisText}>{patologia}</Text>
                </View>
              </View>
            </View>

            <View style={styles.btnContainer}>
              <TouchableOpacity
                style={[styles.btn, styles.btnRefresh]}
                onPress={loadProfile}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.btnText}>🔄 Actualizar datos</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, styles.btnVolver]}
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.btnText}>⬅️ Volver al inicio</Text>
              </TouchableOpacity>
            </View>

            {refreshMessage ? (
              <Text style={{ color: '#10b981', fontWeight: 'bold', marginTop: 8, textAlign: 'center' }}>{refreshMessage}</Text>
            ) : null}
          </>
        )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f0f3ff",
  },
  container: {
    flexGrow: 1,
    alignItems: "center",
    paddingVertical: 20,
    paddingBottom: 40,
    backgroundColor: "#f0f3ff",
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#4a56a6",
    marginBottom: 15,
  },
  infoBanner: {
    backgroundColor: '#e0f2fe',
    borderLeftWidth: 4,
    borderLeftColor: '#0284c7',
    padding: 16,
    borderRadius: 12,
    width: '90%',
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  infoBannerIcon: {
    fontSize: 24,
  },
  infoBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0369a1',
    marginBottom: 4,
  },
  infoBannerText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  card: {
    backgroundColor: "#fff",
    width: "90%",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 5,
  },
  profileRow: {
    paddingVertical: 14,
  },
  profileLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  profileValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  profileEmail: {
    color: '#0284c7',
  },
  diagnosisTag: {
    backgroundColor: '#fef3c7',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
    marginTop: 4,
  },
  diagnosisText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#92400e',
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  btnContainer: {
    marginTop: 24,
    width: "85%",
    gap: 12,
  },
  btn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
  },
  btnRefresh: {
    backgroundColor: "#10b981",
  },
  btnVolver: {
    backgroundColor: "#4a56a6",
  },
  btnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
});
