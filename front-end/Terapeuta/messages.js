// Mensajería con Supabase - Chat entre terapeuta y pacientes
document.addEventListener('DOMContentLoaded', async () => {
  const contactsList = document.getElementById('contactsList');
  const chatTitle = document.getElementById('chatTitle');
  const chatBody = document.getElementById('chatBody');
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');
  const deleteConversationBtn = document.getElementById('deleteConversationBtn');

  let currentTherapistId = null;
  let currentPatientId = null;
  let currentPatientName = null;
  let messagesSubscription = null;
  let typingSubscription = null;
  let typingTimeout = null;
  let isTyping = false;

  // Esperar a que Supabase esté disponible
  let attempts = 0;
  let client = null;
  
  while (!client && attempts < 10) {
    client = window.supabaseClientTherapist || window.supabaseClient || window.supabaseServiceClient || window.supabaseClientAdmin;
    if (!client) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
  }
  
  if (!client) {
    console.error('No se encontró cliente Supabase después de esperar');
    chatBody.innerHTML = '<div class="empty">Error: No se pudo conectar a la base de datos. Por favor, recarga la página.</div>';
    return;
  }

  console.log('Cliente Supabase encontrado:', client ? 'OK' : 'FAIL');

  // Obtener terapeuta autenticado
  try {
    // Primero intentar obtener de la sesión
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    
    if (sessionError || !sessionData?.session?.user) {
      console.error('Usuario no autenticado:', sessionError);
      chatBody.innerHTML = '<div class="empty">Error: Usuario no autenticado. Por favor, inicia sesión nuevamente.</div>';
      setTimeout(() => {
        window.location.href = '../login/index.html';
      }, 2000);
      return;
    }
    
    const user = sessionData.session.user;
    currentTherapistId = user.id;
    console.log('Terapeuta autenticado:', currentTherapistId);
    
    // Cargar lista de pacientes asignados al terapeuta
    await loadPatientsList();
    
  } catch (err) {
    console.error('Error en inicialización:', err);
    chatBody.innerHTML = '<div class="empty">Error al cargar el chat: ' + err.message + '</div>';
  }

  async function loadPatientsList() {
    try {
      // Obtener pacientes asignados a este terapeuta
      const { data: patients, error } = await client
        .from('patients')
        .select('id, user_id, first_name, last_name, email')
        .eq('therapist_id', currentTherapistId)
        .order('first_name', { ascending: true });

      if (error) {
        console.error('Error cargando pacientes:', error);
        return;
      }

      contactsList.innerHTML = '';

      if (!patients || patients.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'No hay pacientes asignados';
        li.style.pointerEvents = 'none';
        li.style.opacity = '0.5';
        contactsList.appendChild(li);
        return;
      }

      // Crear lista de pacientes
      for (const patient of patients) {
        const fullName = `${patient.first_name || ''} ${patient.last_name || ''}`.trim();
        const displayName = fullName || patient.email || 'Paciente';
        
        const li = document.createElement('li');
        li.textContent = displayName;
        li.dataset.patientId = patient.user_id;
        li.dataset.patientName = displayName;
        
        // Verificar si hay mensajes no leídos
        const { count } = await client
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('sender_id', patient.user_id)
          .eq('receiver_id', currentTherapistId)
          .eq('read', false);

        if (count > 0) {
          const badge = document.createElement('span');
          badge.className = 'unread-badge';
          badge.textContent = count;
          li.appendChild(badge);
        }

        li.addEventListener('click', () => selectPatient(patient.user_id, displayName, li));
        contactsList.appendChild(li);
      }

      // Seleccionar el primer paciente automáticamente
      const firstLi = contactsList.querySelector('li[data-patient-id]');
      if (firstLi) {
        firstLi.click();
      }

    } catch (err) {
      console.error('Error en loadPatientsList:', err);
    }
  }

  async function selectPatient(patientId, patientName, li) {
    // Cancelar suscripciones anteriores
    if (messagesSubscription) {
      messagesSubscription.unsubscribe();
      messagesSubscription = null;
    }
    if (typingSubscription) {
      typingSubscription.unsubscribe();
      typingSubscription = null;
    }

    // Marcar como activo
    document.querySelectorAll('.contacts li').forEach(n => n.classList.remove('active'));
    if (li) li.classList.add('active');
    
    currentPatientId = patientId;
    currentPatientName = patientName;
    chatTitle.textContent = patientName;
    chatForm.style.display = 'flex';
    
    // Cargar mensajes existentes
    await loadMessages(patientId);
    
    // Suscribirse a nuevos mensajes
    subscribeToMessages(patientId);
    
    // Suscribirse al estado de "escribiendo"
    subscribeToTypingStatus(patientId);
  }

  async function loadMessages(patientId) {
    try {
      chatBody.innerHTML = '<div class="loading">Cargando mensajes...</div>';

      const { data: messages, error } = await client
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentTherapistId},receiver_id.eq.${patientId}),and(sender_id.eq.${patientId},receiver_id.eq.${currentTherapistId})`)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error cargando mensajes:', error);
        chatBody.innerHTML = '<div class="empty">Error al cargar mensajes</div>';
        return;
      }

      chatBody.innerHTML = '';

      if (!messages || messages.length === 0) {
        chatBody.innerHTML = '<div class="empty">Aún no hay mensajes con este paciente</div>';
        return;
      }

      // Filtrar mensajes que el terapeuta no ha eliminado
      const visibleMessages = messages.filter(msg => {
        if (msg.sender_id === currentTherapistId) {
          // Mensajes enviados por el terapeuta - mostrar si no los ha eliminado
          return !msg.deleted_by_sender;
        } else {
          // Mensajes recibidos del paciente - mostrar si no los ha eliminado
          return !msg.deleted_by_receiver;
        }
      });

      if (visibleMessages.length === 0) {
        chatBody.innerHTML = '<div class="empty">Aún no hay mensajes con este paciente</div>';
        return;
      }

      // Mostrar mensajes
      visibleMessages.forEach(msg => {
        appendMessageToUI(msg);
      });

      // Marcar mensajes del paciente como leídos
      const unreadMessages = messages.filter(msg => 
        msg.sender_id === patientId && !msg.read
      );

      if (unreadMessages.length > 0) {
        await client
          .from('messages')
          .update({ read: true })
          .in('id', unreadMessages.map(m => m.id));

        // Actualizar badge
        const li = document.querySelector(`li[data-patient-id="${patientId}"]`);
        if (li) {
          const badge = li.querySelector('.unread-badge');
          if (badge) badge.remove();
        }
      }

      chatBody.scrollTop = chatBody.scrollHeight;

    } catch (err) {
      console.error('Error en loadMessages:', err);
    }
  }

  function subscribeToMessages(patientId) {
    // Suscribirse a nuevos mensajes en tiempo real
    messagesSubscription = client
      .channel(`messages_${patientId}`)
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
          const isFromPatient = payload.new.sender_id === patientId && payload.new.receiver_id === currentTherapistId;
          const isFromTherapist = payload.new.sender_id === currentTherapistId && payload.new.receiver_id === patientId;
          
          if (isFromPatient || isFromTherapist) {
            // Verificar si el mensaje ya está en el DOM
            const existingMessage = chatBody.querySelector(`[data-message-id="${payload.new.id}"]`);
            if (!existingMessage) {
              appendMessageToUI(payload.new);
            }
            
            // Si es del paciente, marcar como leído
            if (isFromPatient) {
              client
                .from('messages')
                .update({ read: true })
                .eq('id', payload.new.id)
                .then(() => console.log('Mensaje marcado como leído'));
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
            loadMessages(patientId);
          }
        }
      )
      .subscribe((status) => {
        console.log('Estado de suscripción:', status);
      });
  }

  function subscribeToTypingStatus(patientId) {
    typingSubscription = client
      .channel(`typing_${patientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_status',
          filter: `user_id=eq.${patientId},conversation_partner_id=eq.${currentTherapistId}`
        },
        (payload) => {
          console.log('Estado de escritura:', payload);
          if (payload.new && payload.new.is_typing !== undefined) {
            updateTypingIndicator(payload.new.is_typing);
          }
        }
      )
      .subscribe();
  }

  function updateTypingIndicator(typing) {
    isTyping = typing;
    const existingIndicator = chatBody.querySelector('.typing-indicator');
    
    if (typing && !existingIndicator) {
      const indicator = document.createElement('div');
      indicator.className = 'typing-indicator';
      indicator.innerHTML = '<span>escribiendo...</span>';
      chatBody.appendChild(indicator);
      chatBody.scrollTop = chatBody.scrollHeight;
    } else if (!typing && existingIndicator) {
      existingIndicator.remove();
    }
  }

  function handleTyping() {
    if (!currentPatientId || !currentTherapistId) return;

    // Actualizar estado a "escribiendo"
    client
      .from('typing_status')
      .upsert({
        user_id: currentTherapistId,
        conversation_partner_id: currentPatientId,
        is_typing: true,
        updated_at: new Date().toISOString()
      })
      .then(() => console.log('Estado de escritura actualizado'));

    // Limpiar timeout anterior
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }

    // Después de 2 segundos sin escribir, marcar como "no escribiendo"
    typingTimeout = setTimeout(() => {
      client
        .from('typing_status')
        .upsert({
          user_id: currentTherapistId,
          conversation_partner_id: currentPatientId,
          is_typing: false,
          updated_at: new Date().toISOString()
        });
    }, 2000);
  }

  function appendMessageToUI(message) {
    const d = document.createElement('div');
    d.className = 'msg ' + (message.sender_id === currentTherapistId ? 'me' : 'them');
    d.setAttribute('data-message-id', message.id);
    d.textContent = message.message;
    
    // Agregar timestamp con check marks para mensajes enviados
    const time = document.createElement('span');
    time.className = 'msg-time';
    const date = new Date(message.created_at);
    
    // Añadir check marks solo para mensajes enviados por el terapeuta
    if (message.sender_id === currentTherapistId) {
      const checkMarks = message.read ? '✓✓' : '✓✓';
      const checkClass = message.read ? 'read' : 'delivered';
      time.innerHTML = `${date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} <span class="check-mark ${checkClass}">${checkMarks}</span>`;
    } else {
      time.textContent = date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    }
    
    d.appendChild(time);
    
    chatBody.appendChild(d);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  // Submit handler para enviar mensajes
  chatForm.onsubmit = async function(e) {
    e.preventDefault();
    const text = chatInput.value.trim();
    
    if (!text || !currentPatientId) return;
    
    chatInput.value = '';
    
    // Limpiar estado de escritura
    if (typingTimeout) clearTimeout(typingTimeout);
    await client
      .from('typing_status')
      .upsert({
        user_id: currentTherapistId,
        conversation_partner_id: currentPatientId,
        is_typing: false,
        updated_at: new Date().toISOString()
      });
    
    try {
      const { data, error } = await client
        .from('messages')
        .insert([
          {
            sender_id: currentTherapistId,
            receiver_id: currentPatientId,
            message: text,
            read: false
          }
        ])
        .select()
        .single();

      if (error) {
        console.error('Error enviando mensaje:', error);
        alert('Error al enviar el mensaje');
        return;
      }

      console.log('Mensaje enviado correctamente:', data);
      // El mensaje aparecerá automáticamente vía la suscripción en tiempo real

    } catch (err) {
      console.error('Error en envío de mensaje:', err);
      alert('Error al enviar el mensaje');
    }
  };

  // Evento para detectar cuando el terapeuta está escribiendo
  chatInput.addEventListener('input', handleTyping);

  // Eliminar conversación
  deleteConversationBtn.addEventListener('click', async function() {
    if (!currentPatientId || !currentTherapistId) return;
    
    if (!confirm(`¿Estás seguro de que deseas eliminar toda la conversación con ${currentPatientName}? Solo se eliminará para ti.`)) {
      return;
    }

    try {
      // Marcar mensajes como eliminados para el terapeuta
      // Mensajes enviados por el terapeuta: marcar deleted_by_sender = true
      const { error: senderError } = await client
        .from('messages')
        .update({ deleted_by_sender: true })
        .eq('sender_id', currentTherapistId)
        .eq('receiver_id', currentPatientId);

      // Mensajes recibidos del paciente: marcar deleted_by_receiver = true
      const { error: receiverError } = await client
        .from('messages')
        .update({ deleted_by_receiver: true })
        .eq('sender_id', currentPatientId)
        .eq('receiver_id', currentTherapistId);

      if (senderError || receiverError) {
        console.error('Error eliminando conversación:', senderError || receiverError);
        alert('Error al eliminar la conversación');
        return;
      }

      // Limpiar la UI
      chatBody.innerHTML = '<div class="empty">Conversación eliminada</div>';
      alert('Conversación eliminada correctamente');

    } catch (err) {
      console.error('Error en eliminación de conversación:', err);
      alert('Error al eliminar la conversación');
    }
  });
});
