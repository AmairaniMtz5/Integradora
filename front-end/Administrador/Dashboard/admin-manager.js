// admin-manager.js
// Responsible for populating admin name/photo/id in the admin sidebar/header
console.log('[admin-manager] Script cargado, iniciando...');
(function(){
  function qs(sel){ return document.querySelector(sel); }

  async function fetchMeFromApi(){
    try{
      // read in-memory auth token only (no localStorage)
      const token = window.__authToken || null;
      if(!token) return null;
      const res = await fetch('/api/auth/me', { headers: { 'Authorization': 'Bearer ' + token } });
      if(!res.ok) return null;
      const data = await res.json();
      if(data && data.user){
        try{ window.__currentUser = data.user; }catch(e){}
        return data.user;
      }
      return data && data.user ? data.user : null;
    }catch(e){ console.warn('Could not fetch /api/auth/me', e); return null; }
  }

  async function getCurrentUser(){
    console.log('[admin-manager] getCurrentUser() llamado');
    // 1) In-memory
    try{ 
      if(window.__currentUser){ 
        console.log('[admin-manager] usando __currentUser en memoria:', window.__currentUser);
        return window.__currentUser; 
      } 
    }catch(e){}
    // SKIP localStorage fallbacks para forzar consulta a Supabase
    console.log('[admin-manager] no hay usuario en memoria, consultando Supabase...');
    // 2) Supabase session + users table
    try{
      if(window.supabaseClient){
        const { data: sessionData } = await window.supabaseClient.auth.getSession();
        const session = sessionData && sessionData.session ? sessionData.session : null;
        if(session){
          const authUser = session.user;
          let profile = null;
          // Primer intento incluyendo photo_url
          try{
            console.log('[admin-manager] Consultando users para id:', authUser.id);
            const { data: userRow, error: userErr } = await window.supabaseClient
              .from('users')
              .select('id, email, full_name, role, phone, clinic, photo_url')
              .eq('id', authUser.id)
              .maybeSingle();
            console.log('[admin-manager] userRow:', userRow);
            console.log('[admin-manager] userErr:', userErr);
            if(!userErr && userRow){ 
              profile = userRow;
              console.log('[admin-manager] profile cargado:', profile);
              console.log('[admin-manager] photo_url en profile:', profile.photo_url);
            }
            else if(userErr && userErr.code === '42703'){
              console.warn('[admin-manager] columna photo_url ausente, reintentando sin ella');
              const { data: userRow2, error: userErr2 } = await window.supabaseClient
                .from('users')
                .select('id, email, full_name, role, phone, clinic')
                .eq('id', authUser.id)
                .maybeSingle();
              if(!userErr2 && userRow2) profile = userRow2;
            }
          }catch(e){ console.warn('users table fetch error', e.message); }
          const merged = {
            id: authUser.id,
            email: profile?.email || authUser.email,
            full_name: profile?.full_name || authUser.user_metadata?.full_name || '',
            role: profile?.role || authUser.user_metadata?.role || 'admin',
            clinic: profile?.clinic || authUser.user_metadata?.clinic || '',
            photo: (profile && profile.photo_url) || authUser.user_metadata?.photo_url || authUser.user_metadata?.photo || ''
          };
          console.log('[admin-manager] merged profile:', merged);
          console.log('[admin-manager] merged.photo:', merged.photo);
          window.__currentUser = merged;
          return merged;
        }
      }
    }catch(e){ console.warn('Supabase session/profile error', e.message); }
    // 3) Fallback local legacy (para transición)
    try{
      const legacy = JSON.parse(localStorage.getItem('currentUser_admin')||'null');
      if(legacy){ window.__currentUser = legacy; return legacy; }
    }catch(e){}
    // 4) API fallback
    return await fetchMeFromApi();
  }

  function setProfile(user){
    if(!user) return;
    // Try multiple selectors for name/email/photo so the profile appears across different pages
    const nameSelectors = [
      '#adminName', '#therapistName', '.profile h3', '.profile .name', '.user-name', '[data-user-name]'
    ];
    const emailSelectors = [
      '#adminEmail', '#therapistEmail', '.profile p.muted', '.profile .email', '.user-email', '[data-user-email]'
    ];
    const photoSelectors = [
      '#adminPhoto', '#therapistPhoto', '.profile img', '.avatar img', '.profile-avatar', '.avatar', '[data-user-photo]'
    ];

    function applyToFirst(selectors, applyFn){
      for(const s of selectors){
        try{
          const nodes = document.querySelectorAll(s);
          if(!nodes || nodes.length === 0) continue;
          console.debug('[admin-manager] selector matched:', s, 'nodes:', nodes.length);
          nodes.forEach(n => { try{ applyFn(n); }catch(e){} });
          return true;
        }catch(e){ console.warn('[admin-manager] invalid selector', s, e); }
      }
      console.debug('[admin-manager] no selector matched from list:', selectors);
      return false;
    }

    const displayName = user.full_name || user.name || user.fullname || user.email || 'Administrador';
    applyToFirst(nameSelectors, el => { el.textContent = displayName; });

    // set email if available — force set the #adminEmail and #therapistEmail elements first for pages that include them
    const displayEmail = user.email || user.mail || user.correo || '';
    try{
      const directAdminEmail = document.getElementById('adminEmail');
      if(directAdminEmail){ directAdminEmail.textContent = displayEmail || ''; directAdminEmail.style.display = displayEmail ? '' : 'none'; }
      const directTherapistEmail = document.getElementById('therapistEmail');
      if(directTherapistEmail){ directTherapistEmail.textContent = displayEmail || ''; directTherapistEmail.style.display = displayEmail ? '' : 'none'; }
    }catch(e){}
    if(displayEmail) applyToFirst(emailSelectors, el => {
      // Only replace generic <p> if it looks like an ID line or is muted/placeholder
      try{
        const tag = (el.tagName || '').toLowerCase();
        const text = (el.textContent || '').trim();
        const looksLikeId = /\bID\b[:]?/i.test(text) || /\d{3,}/.test(text);
        const isMuted = el.classList && (el.classList.contains('muted') || el.classList.contains('muted-text'));
        if(tag === 'p'){
          if(looksLikeId || isMuted || !text){ el.textContent = displayEmail; }
          else { /* preserve other paragraph content if it doesn't look like placeholder */ }
        } else {
          el.textContent = displayEmail;
        }
      }catch(e){ try{ el.textContent = displayEmail; }catch(_){} }
    });

    // set photo: support <img> and elements that use background-image or .src
    const photoSrc = user.photo || user.photoUrl || user.photo_url || user.avatar || '';
    // Force show admin/therapist photo elements when available
    try{
      const aPhoto = document.getElementById('adminPhoto'); if(aPhoto && photoSrc){ try{ aPhoto.setAttribute('src', photoSrc); aPhoto.style.display=''; }catch(e){} }
      const tPhoto = document.getElementById('therapistPhoto'); if(tPhoto && photoSrc){ try{ tPhoto.setAttribute('src', photoSrc); tPhoto.style.display=''; }catch(e){} }
    }catch(e){}
    if(!photoSrc){
      console.warn('[admin-manager] photoSrc vacío. Intentando recuperar de auth_profile/localStorage');
      try{
        const ap = localStorage.getItem('auth_profile');
        if(ap){
          const parsed = JSON.parse(ap);
          const fallbackPhoto = parsed.photo || parsed.photoUrl || parsed.photo_url || '';
          if(fallbackPhoto){
            console.debug('[admin-manager] Reaplicando foto desde auth_profile');
            const aPhoto2 = document.getElementById('adminPhoto'); if(aPhoto2){ aPhoto2.src = fallbackPhoto; aPhoto2.style.display=''; }
          }
        }
      }catch(e){ console.warn('[admin-manager] fallback photo error', e.message); }
    }
    if(photoSrc){
      applyToFirst(photoSelectors, el => {
        // If it's an <img>
        if(el.tagName && el.tagName.toLowerCase() === 'img'){
          try{ el.setAttribute('src', photoSrc); }catch(e){ try{ el.src = photoSrc; }catch(e){} }
          el.alt = displayName;
          el.style.display = '';
          el.onerror = function(){ try{ el.setAttribute('src', 'avatar.png'); el.style.display = ''; }catch(e){ el.src = 'avatar.png'; el.style.display = ''; } };
          return;
        }
        // If element uses background-image (e.g., .avatar)
        try{ el.style.backgroundImage = 'url("' + photoSrc + '")'; el.style.backgroundSize = 'cover'; el.style.backgroundPosition = 'center'; }catch(e){}
      });
    }

    // hide any admin ID paragraphs if present to keep UI tidy
    try{
      const idP = document.querySelector('.profile p#adminID, .profile p#therapistID');
      if(idP) idP.style.display = 'none';
    }catch(e){}
  }
  // Try to read current user synchronously (fast path) so we can apply profile immediately
  function getCurrentUserSync(){
    try{ if(window.__currentUser) return window.__currentUser; }catch(e){}
    try{ const ap = localStorage.getItem('auth_profile'); if(ap) return JSON.parse(ap); }catch(e){}
    try{ const cu = sessionStorage.getItem('currentUser'); if(cu) return JSON.parse(cu); }catch(e){}
    try{ const legacy = localStorage.getItem('currentUser_admin'); if(legacy) return JSON.parse(legacy); }catch(e){}
    return null;
  }

  (function initProfile(){
    // SKIP fast synchronous attempt - always wait for Supabase to ensure photo_url is loaded
    console.log('[admin-manager] initProfile: esperando consulta async a Supabase');
  })();

  document.addEventListener('DOMContentLoaded', async function(){
    console.log('[admin-manager] DOMContentLoaded: consultando getCurrentUser()');
    let user = await getCurrentUser();
    console.log('[admin-manager] getCurrentUser returned:', user);
    // if user is present, propagate to in-memory current user
    if(user){
      try{ window.__currentUser = user; }catch(e){}
      console.debug('[admin-manager] using user:', user && (user.email || user.name));
      setProfile(user);
      // If the profile DOM isn't present yet or may be replaced by other scripts,
      // observe the DOM and re-apply the profile when elements appear.
      try{
        const applyWhenPresent = function(){
          if(document.querySelector('#adminName') || document.querySelector('.profile')){
            setProfile(user);
            return true;
          }
          return false;
        };
        if(!applyWhenPresent()){
          const mo = new MutationObserver((mutations, obs) => {
            if(applyWhenPresent()){ obs.disconnect(); }
          });
          mo.observe(document.documentElement || document.body, { childList: true, subtree: true });
        }
      }catch(e){ /* ignore observer errors */ }
    }
    else {
      console.debug('[admin-manager] no user found after fallbacks; profile will not be applied');
    }
  });

  // If the script is loaded after DOMContentLoaded already fired, run the same logic immediately
  if(document.readyState !== 'loading'){
    (async function(){
      try{
        let user = await getCurrentUser();
        if(user){
          try{ window.__currentUser = user; }catch(e){}
          setProfile(user);
          // attempt to re-apply when elements appear, as in the DOMContentLoaded handler
          try{
            const applyWhenPresent = function(){
              if(document.querySelector('#adminName') || document.querySelector('.profile')){
                setProfile(user);
                return true;
              }
              return false;
            };
            if(!applyWhenPresent()){
              const mo = new MutationObserver((mutations, obs) => { if(applyWhenPresent()){ obs.disconnect(); } });
              mo.observe(document.documentElement || document.body, { childList: true, subtree: true });
            }
          }catch(e){}
        }
      }catch(e){ /* ignore */ }
    })();
  }

  // expose for manual refresh/debug
  window.__adminManager = {
    getCurrentUser,
    setProfile,
    // helper: force-apply an in-memory user for debugging
    loadLocalProfile: function(user){
      try{
        if(!user && window.__currentUser) user = window.__currentUser;
        if(!user){
          // try persisted current user
          try{ if(window.localStore && typeof window.localStore.getCurrentUser === 'function') user = window.localStore.getCurrentUser(); }catch(e){}
          if(!user){ try{ user = JSON.parse(localStorage.getItem('currentUser_admin')||'null'); }catch(e){} }
        }
        if(user){ window.__currentUser = user; console.debug('[admin-manager] loadLocalProfile applied user:', user && (user.email||user.name)); setProfile(user); return user; }
      }catch(e){ console.error('[admin-manager] loadLocalProfile error', e); }
      return null;
    },
    // debug helper
    debugLocalProfile: function(){
      try{
        const fromLocalStore = (window.localStore && typeof window.localStore.getCurrentUser === 'function') ? window.localStore.getCurrentUser() : null;
        const fromLS = JSON.parse(localStorage.getItem('currentUser_admin')||'null');
        return { localStore: fromLocalStore, localStorage: fromLS };
      }catch(e){ console.error('debugLocalProfile error', e); return null; }
    }
  };

  // Immediately attempt to load any persisted local profile so pages show the admin without manual steps
  try{ window.__adminManager.loadLocalProfile(); }catch(e){ /* ignore */ }
  // logout helper used across admin pages
  window.logoutAdmin = function(){
    try{ window.__authToken = null; window.__currentUser = null; }catch(e){}
    window.location.href = '../login/index.html';
  };

  // If no user is found, remove default placeholder texts so the page doesn't show generic admin values
  function clearDefaultPlaceholders(){
    try{
      const nameEls = document.querySelectorAll('#adminName, #therapistName, .user-name');
      const emailEls = document.querySelectorAll('#adminEmail, #therapistEmail, .user-email');
      const photoEls = document.querySelectorAll('#adminPhoto, #therapistPhoto, .profile img');
      nameEls.forEach(el => {
        try{ const t = (el.textContent||'').trim(); if(!t || /^(administrador|admin)$/i.test(t)) el.textContent = ''; }catch(e){}
      });
      emailEls.forEach(el => {
        try{ const t = (el.textContent||'').trim(); if(!t || /^admin@/.test(t) || /@ejemplo\.com$/i.test(t)) el.textContent = ''; }catch(e){}
      });
      photoEls.forEach(el => {
        try{
          if(el.tagName && el.tagName.toLowerCase() === 'img'){
            // if image is default avatar, hide it
            const src = el.getAttribute('src') || '';
            if(/avatar(\.png|\.jpg|\.webp)?$/i.test(src) || /default/i.test(src)){
              el.style.display = 'none';
            }
          }
        }catch(e){}
      });
    }catch(e){ /* ignore */ }
  }

  // Expose debug helper to inspect localStore/currentUser quickly from console
  window.debugLocalProfile = function(){
    try{
      const fromLocalStore = (window.localStore && typeof window.localStore.getCurrentUser === 'function') ? window.localStore.getCurrentUser() : null;
      const fromLS = JSON.parse(localStorage.getItem('currentUser_admin')||'null');
      console.log('debugLocalProfile -> localStore.getCurrentUser():', fromLocalStore, 'localStorage.currentUser_admin:', fromLS);
      return { localStore: fromLocalStore, localStorage: fromLS };
    }catch(e){ console.error('debugLocalProfile error', e); return null; }
  };

  // Run placeholder cleanup shortly after load in case no user is available
  setTimeout(clearDefaultPlaceholders, 300);
})();
