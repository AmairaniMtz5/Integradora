import { useState, useEffect, useRef } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
} from "react-native";
import { supabase } from "../supabaseClient";

export default function ChatScreen({ navigation }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [therapistId, setTherapistId] = useState(null);
  const [therapistName, setTherapistName] = useState("Fisioterapeuta");
  const [currentUserId, setCurrentUserId] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef(null);
  const subscriptionRef = useRef(null);
  const typingSubscriptionRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    loadChatData();
    return () => {
      // Limpiar suscripciones cuando se desmonte el componente
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
      if (typingSubscriptionRef.current) {
        typingSubscriptionRef.current.unsubscribe();
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Scroll automático cuando lleguen nuevos mensajes
    if (messages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const loadChatData = async () => {
    try {
      setLoading(true);
      
      // Obtener usuario actual
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.log('Usuario no autenticado');
        setLoading(false);
        return;
      }
      
      setCurrentUserId(user.id);

      // Obtener información del paciente para encontrar su terapeuta
      const { data: patient, error: patientError } = await supabase
        .from('patients')
        .select('therapist_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (patientError) {
        console.log('Error obteniendo terapeuta:', patientError);
        setLoading(false);
        return;
      }

      if (!patient || !patient.therapist_id) {
        console.log('No se encontró terapeuta asignado');
        setLoading(false);
        return;
      }

      setTherapistId(patient.therapist_id);

      // Obtener información del terapeuta
      const { data: therapist, error: therapistError } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', patient.therapist_id)
        .single();

      if (!therapistError && therapist) {
        setTherapistName(therapist.full_name || 'Fisioterapeuta');
      }

      // Cargar mensajes existentes
      await loadMessages(user.id, patient.therapist_id);

      // Suscribirse a nuevos mensajes en tiempo real
      subscribeToMessages(user.id, patient.therapist_id);

      // Suscribirse al estado de "escribiendo"
      subscribeToTypingStatus(user.id, patient.therapist_id);

    } catch (err) {
      console.error('Error en loadChatData:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (userId, therapistId) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${userId},receiver_id.eq.${therapistId}),and(sender_id.eq.${therapistId},receiver_id.eq.${userId})`)
        .or(`deleted_by_sender.eq.false,deleted_by_receiver.eq.false`)
        .order('created_at', { ascending: true });

      if (error) {
        console.log('Error cargando mensajes:', error);
        return;
      }

      // Filtrar mensajes que el paciente (usuario actual) no ha eliminado
      const visibleMessages = data.filter(msg => {
        if (msg.sender_id === userId) {
          // Mensajes enviados por el paciente - mostrar si no los ha eliminado
          return !msg.deleted_by_sender;
        } else {
          // Mensajes recibidos del terapeuta - mostrar si no los ha eliminado
          return !msg.deleted_by_receiver;
        }
      });

      const formattedMessages = visibleMessages.map(msg => ({
        id: msg.id,
        text: msg.message,
        sender: msg.sender_id === userId ? 'paciente' : 'fisioterapeuta',
        created_at: msg.created_at,
        read: msg.read
      }));

      setMessages(formattedMessages);

      // Marcar mensajes como leídos
      const unreadMessages = data.filter(msg => 
        msg.receiver_id === userId && !msg.read
      );

      if (unreadMessages.length > 0) {
        await supabase
          .from('messages')
          .update({ read: true })
          .in('id', unreadMessages.map(m => m.id));
      }

    } catch (err) {
      console.error('Error en loadMessages:', err);
    }
  };

  const subscribeToMessages = (userId, therapistId) => {
    // Cancelar suscripción anterior si existe
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }

    // Crear nueva suscripción para TODOS los mensajes de esta conversación
    subscriptionRef.current = supabase
      .channel('messages_channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          console.log('Nuevo mensaje detectado:', payload);
          
          // Verificar si este mensaje pertenece a esta conversación
          const isFromTherapist = payload.new.sender_id === therapistId && payload.new.receiver_id === userId;
          const isFromPatient = payload.new.sender_id === userId && payload.new.receiver_id === therapistId;
          
          if (isFromTherapist || isFromPatient) {
            const newMessage = {
              id: payload.new.id,
              text: payload.new.message,
              sender: payload.new.sender_id === userId ? 'paciente' : 'fisioterapeuta',
              created_at: payload.new.created_at,
              read: payload.new.read
            };
            
            // Solo agregar si no está ya en la lista (evitar duplicados)
            setMessages(prev => {
              const exists = prev.some(msg => msg.id === newMessage.id);
              if (exists) return prev;
              return [...prev, newMessage];
            });

            // Si es un mensaje del terapeuta, marcarlo como leído
            if (isFromTherapist) {
              supabase
                .from('messages')
                .update({ read: true })
                .eq('id', payload.new.id)
                .then(() => console.log('Mensaje marcado como leído'));
            } else {
              // Actualizar contador de no leídos
              updateUnreadCount(userId, therapistId);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          console.log('Mensaje actualizado:', payload);
          // Si se eliminan mensajes, recargar
          if (payload.new.deleted_by_sender || payload.new.deleted_by_receiver) {
            loadMessages(userId, therapistId);
          }
        }
      )
      .subscribe((status) => {
        console.log('Estado de suscripción:', status);
      });
  };

  const subscribeToTypingStatus = (userId, therapistId) => {
    typingSubscriptionRef.current = supabase
      .channel('typing_channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_status',
          filter: `user_id=eq.${therapistId},conversation_partner_id=eq.${userId}`
        },
        (payload) => {
          console.log('Estado de escritura:', payload);
          if (payload.new && payload.new.is_typing !== undefined) {
            setIsTyping(payload.new.is_typing);
          }
        }
      )
      .subscribe();
  };

  const handleTyping = async () => {
    if (!currentUserId || !therapistId) return;

    try {
      // Actualizar estado a "escribiendo"
      await supabase
        .from('typing_status')
        .upsert({
          user_id: currentUserId,
          conversation_partner_id: therapistId,
          is_typing: true,
          updated_at: new Date().toISOString()
        });

      // Limpiar timeout anterior
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Después de 2 segundos sin escribir, marcar como "no escribiendo"
      typingTimeoutRef.current = setTimeout(async () => {
        await supabase
          .from('typing_status')
          .upsert({
            user_id: currentUserId,
            conversation_partner_id: therapistId,
            is_typing: false,
            updated_at: new Date().toISOString()
          });
      }, 2000);
    } catch (err) {
      console.error('Error actualizando estado de escritura:', err);
    }
  };

  const updateUnreadCount = async (userId, therapistId) => {
    try {
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('sender_id', therapistId)
        .eq('receiver_id', userId)
        .eq('read', false);

      if (!error) {
        setUnreadCount(count || 0);
      }
    } catch (err) {
      console.error('Error actualizando contador:', err);
    }
  };

  const sendMessage = async () => {
    if (input.trim() === "" || !currentUserId || !therapistId) return;

    const messageText = input.trim();
    setInput("");

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert([
          {
            sender_id: currentUserId,
            receiver_id: therapistId,
            message: messageText,
            read: false
          }
        ])
        .select()
        .single();

      if (error) {
        console.log('Error enviando mensaje:', error);
        return;
      }

      console.log('Mensaje enviado correctamente:', data);
      // El mensaje aparecerá automáticamente vía la suscripción en tiempo real

    } catch (err) {
      console.error('Error en sendMessage:', err);
    }
  };

  const deleteConversation = () => {
    Alert.alert(
      "Eliminar conversación",
      "¿Estás seguro de que deseas eliminar toda la conversación con tu fisioterapeuta? Solo se eliminará para ti.",
      [
        {
          text: "Cancelar",
          style: "cancel"
        },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              if (!currentUserId || !therapistId) return;

              // Marcar mensajes como eliminados para el paciente
              // Mensajes enviados por el paciente: marcar deleted_by_sender = true
              const { error: senderError } = await supabase
                .from('messages')
                .update({ deleted_by_sender: true })
                .eq('sender_id', currentUserId)
                .eq('receiver_id', therapistId);

              // Mensajes recibidos del terapeuta: marcar deleted_by_receiver = true
              const { error: receiverError } = await supabase
                .from('messages')
                .update({ deleted_by_receiver: true })
                .eq('sender_id', therapistId)
                .eq('receiver_id', currentUserId);

              if (senderError || receiverError) {
                console.log('Error eliminando conversación:', senderError || receiverError);
                Alert.alert('Error', 'No se pudo eliminar la conversación');
                return;
              }

              setMessages([]);
              Alert.alert('Éxito', 'Conversación eliminada correctamente');
            } catch (err) {
              console.error('Error en deleteConversation:', err);
              Alert.alert('Error', 'Ocurrió un error al eliminar la conversación');
            }
          }
        }
      ]
    );
  };

  const renderMessage = ({ item }) => (
    <View
      style={[
        styles.messageBubble,
        item.sender === "paciente" ? styles.userBubble : styles.therapistBubble,
      ]}
    >
      <Text
        style={[
          styles.messageText,
          item.sender === "paciente" ? { color: "#fff" } : { color: "#333" },
        ]}
      >
        {item.text}
      </Text>
      {item.sender === "paciente" && (
        <Text style={[styles.checkMark, item.read ? styles.checkRead : styles.checkDelivered]}>
          ✓✓
        </Text>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7a8ce2" />
          <Text style={styles.loadingText}>Cargando chat...</Text>
        </View>
      ) : (
        <>
          <View style={styles.headerContainer}>
            <Text style={styles.header}>💬 Chat con tu fisioterapeuta</Text>
            <Text style={styles.subHeader}>{therapistName}</Text>
            {messages.length > 0 && (
              <TouchableOpacity 
                style={styles.deleteBtn}
                onPress={deleteConversation}
              >
                <Text style={styles.deleteBtnText}>🗑️ Eliminar conversación</Text>
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            style={styles.chatContainer}
            contentContainerStyle={styles.chatContentContainer}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListFooterComponent={
              isTyping ? (
                <View style={styles.typingIndicator}>
                  <Text style={styles.typingText}>escribiendo...</Text>
                </View>
              ) : null
            }
          />

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Escribe tu mensaje..."
              value={input}
              onChangeText={(text) => {
                setInput(text);
                handleTyping();
              }}
              multiline
              maxLength={500}
            />
            <TouchableOpacity 
              style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]} 
              onPress={sendMessage}
              disabled={!input.trim()}
            >
              <Text style={styles.sendText}>📨</Text>
            </TouchableOpacity>
          </View>

          {/* Botón para regresar al menú */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.navigate("Main")}
          >
            <Text style={styles.backBtnText}>⬅️ Regresar al menú</Text>
          </TouchableOpacity>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f3ff",
  },
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
  headerContainer: {
    marginTop: 60,
    paddingHorizontal: 15,
  },
  header: {
    fontSize: 22,
    fontWeight: "800",
    color: "#4a56a6",
    marginBottom: 5,
    textAlign: "center",
  },
  subHeader: {
    fontSize: 16,
    color: "#7a8ce2",
    marginBottom: 10,
    textAlign: "center",
  },
  deleteBtn: {
    backgroundColor: "#ff4757",
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 10,
    alignSelf: "center",
    marginTop: 5,
  },
  deleteBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  chatContainer: {
    flex: 1,
    marginBottom: 10,
    paddingHorizontal: 15,
  },
  chatContentContainer: {
    paddingBottom: 10,
    paddingTop: 10,
  },
  messageBubble: {
    maxWidth: "75%",
    borderRadius: 15,
    padding: 10,
    marginVertical: 6,
  },
  therapistBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#dbeafe",
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#7a8ce2",
  },
  messageText: {
    fontSize: 15,
  },
  checkMark: {
    fontSize: 12,
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  checkDelivered: {
    color: 'rgba(255,255,255,0.5)', // Gris translúcido para entregado
  },
  checkRead: {
    color: '#34b7f1', // Azul WhatsApp para leído
  },
  typingIndicator: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginBottom: 10,
  },
  typingText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#7a8ce2',
  },
  keyboardAvoidingView: {
    backgroundColor: '#f5f5f5',
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 25,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginHorizontal: 15,
    marginVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#333",
    maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: "#7a8ce2",
    borderRadius: 20,
    padding: 8,
  },
  sendBtnDisabled: {
    backgroundColor: "#ccc",
  },
  sendText: {
    fontSize: 18,
    color: "#fff",
  },
  backBtn: {
    backgroundColor: "#fff",
    borderRadius: 15,
    paddingVertical: 12,
    alignItems: "center",
    marginHorizontal: 15,
    marginBottom: 20,
    elevation: 3,
  },
  backBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#4a56a6",
  },
});
