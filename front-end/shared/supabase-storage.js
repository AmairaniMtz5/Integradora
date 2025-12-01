// Supabase Storage helper for profile photos
(function(){
  const BUCKET = 'avatars';

  async function ensureBucket(){
    const client = window.supabaseServiceClient || window.supabaseClient;
    if(!client) throw new Error('Supabase client no inicializado');
    try {
      // list buckets to see if exists
      const { data: buckets, error: listErr } = await client.storage.listBuckets();
      if(listErr){ console.warn('[storage] listBuckets error', listErr.message); }
      if(Array.isArray(buckets) && buckets.some(b => b.name === BUCKET)) return { exists: true };
      // create bucket public
      const { data: created, error: createErr } = await client.storage.createBucket(BUCKET, { public: true });
      if(createErr){ console.warn('[storage] createBucket error', createErr.message); return { exists: false, error: createErr.message }; }
      console.log('[storage] bucket creado', created);
      return { exists: true, created: true };
    } catch(e){ console.warn('[storage] ensureBucket exception', e.message); return { exists: false, error: e.message }; }
  }

  function sanitizeFilename(name){
    return String(name||'image').replace(/[^a-zA-Z0-9._-]/g,'_');
  }

  async function uploadProfilePhoto(userId, file){
    if(!file) return { success:false, error:'Archivo no proporcionado' };
    const client = window.supabaseServiceClient || window.supabaseClient;
    if(!client) return { success:false, error:'Supabase client no inicializado' };
    try {
      await ensureBucket();
      const ext = file.name && file.name.lastIndexOf('.')!==-1 ? file.name.substring(file.name.lastIndexOf('.')) : '.jpg';
      const path = userId + '/' + Date.now() + '-' + sanitizeFilename(file.name || ('foto' + ext));
      const { data, error } = await client.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type || 'image/jpeg' });
      if(error){ return { success:false, error:error.message }; }
      // Obtener URL pública
      const { data: publicData } = client.storage.from(BUCKET).getPublicUrl(path);
      const publicUrl = publicData && publicData.publicUrl ? publicData.publicUrl : null;
      return { success:true, path, publicUrl };
    } catch(e){ return { success:false, error:e.message }; }
  }

  window.SupabaseStorage = { ensureBucket, uploadProfilePhoto };
})();
