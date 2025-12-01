/**
 * Script para inicializar ejercicios en Supabase desde videos bundled
 * Ejecutar una vez desde la consola del navegador como Admin
 * 
 * Uso: node scripts/init-exercises-to-supabase.js
 * O copiar y pegar en la consola del navegador estando logueado como admin
 */

(async function initExercisesToSupabase() {
  console.log('[init-exercises] Iniciando migración de ejercicios a Supabase...');

  // Verificar que existe el cliente de Supabase
  const client = window.supabaseServiceClient || window.supabaseClient;
  if (!client) {
    console.error('[init-exercises] ❌ No se encontró cliente de Supabase');
    return;
  }

  // Definición de patologías y sus carpetas de videos
  const pathologies = {
    'escoliosis': 'Escoliosis lumbar',
    'espondilolisis': 'Espondilólisis',
    'hernia': 'Hernia de disco lumbar',
    'lumbalgia': 'Lumbalgia mecánica inespecífica'
  };

  const pathologyIcons = {
    'escoliosis': '🧭',
    'espondilolisis': '🦴',
    'hernia': '💥',
    'lumbalgia': '⚡'
  };

  // Función para cargar videos bundled desde manifest
  async function loadBundledVideos() {
    try {
      console.log('[init-exercises] Ubicación actual:', window.location.href);
      
      // Intentar varias rutas posibles
      const possiblePaths = [
        '../Ejercicios/videos/',
        './Ejercicios/videos/',
        '/Administrador/Ejercicios/videos/',
        'Ejercicios/videos/',
        '../../Ejercicios/videos/'
      ];
      
      let basePath = null;
      let rootManifest = null;
      
      // Probar cada ruta hasta encontrar una que funcione
      for (const path of possiblePaths) {
        try {
          const testPath = path + 'manifest.json';
          console.log('[init-exercises] Probando:', testPath);
          const resp = await fetch(testPath);
          if (resp.ok) {
            basePath = path;
            rootManifest = await resp.json();
            console.log('[init-exercises] ✓ Ruta encontrada:', basePath);
            break;
          }
        } catch (e) {
          // Continuar con la siguiente ruta
        }
      }
      
      if (!basePath || !rootManifest) {
        console.error('[init-exercises] No se pudo encontrar manifest.json en ninguna ruta');
        return [];
      }
      
      // El manifest es un array directo de videos
      const videos = Array.isArray(rootManifest) ? rootManifest : (rootManifest.videos || []);
      console.log('[init-exercises] Videos en manifest:', videos.length);
      
      // Convertir al formato esperado, extrayendo la carpeta del path
      const allVideos = videos.map(video => {
        // Extraer carpeta del path: "videos/Escoliosis lumbar/..." -> "Escoliosis lumbar"
        const pathParts = video.path.split('/');
        const folder = pathParts.length > 2 ? pathParts[1] : (video.notes || '');
        
        return {
          id: video.id,
          name: video.name,
          notes: video.notes || video.description || '',
          path: basePath + video.path,
          folder: folder
        };
      });
      
      return allVideos;
    } catch (err) {
      console.error('[init-exercises] Error cargando videos:', err);
      return [];
    }
  }

  // Función para normalizar nombre de carpeta a clave de patología
  function folderToPathologyKey(folderName) {
    const normalized = folderName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    if (normalized.includes('escoliosis')) return 'escoliosis';
    if (normalized.includes('espondilolisis')) return 'espondilolisis';
    if (normalized.includes('hernia')) return 'hernia';
    if (normalized.includes('lumbalgia')) return 'lumbalgia';
    
    return null;
  }

  // Cargar videos bundled
  console.log('[init-exercises] Cargando videos bundled...');
  const videos = await loadBundledVideos();
  console.log(`[init-exercises] Videos encontrados: ${videos.length}`);

  if (videos.length === 0) {
    console.warn('[init-exercises] ⚠️  No se encontraron videos. Verifica las rutas.');
    return;
  }

  // Agrupar videos por patología
  const videosByPathology = {};
  videos.forEach(video => {
    const pathologyKey = folderToPathologyKey(video.folder);
    if (pathologyKey) {
      if (!videosByPathology[pathologyKey]) {
        videosByPathology[pathologyKey] = [];
      }
      videosByPathology[pathologyKey].push(video);
    }
  });

  console.log('[init-exercises] Videos agrupados por patología:', 
    Object.keys(videosByPathology).map(k => `${k}: ${videosByPathology[k].length}`).join(', '));

  // Insertar ejercicios en Supabase
  let totalInserted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const [pathologyKey, pathologyVideos] of Object.entries(videosByPathology)) {
    console.log(`\n[init-exercises] Procesando patología: ${pathologyKey} (${pathologyVideos.length} videos)`);
    
    for (const video of pathologyVideos) {
      try {
        // Verificar si ya existe este ejercicio
        const { data: existing, error: checkError } = await client
          .from('exercises')
          .select('id')
          .eq('video_id', video.id)
          .eq('pathology', pathologyKey)
          .maybeSingle();

        if (checkError) {
          console.warn(`[init-exercises] Error verificando ejercicio ${video.id}:`, checkError.message);
          totalErrors++;
          continue;
        }

        if (existing) {
          console.log(`  ↪ Omitido (ya existe): ${video.name}`);
          totalSkipped++;
          continue;
        }

        // Insertar nuevo ejercicio
        const exerciseData = {
          video_id: video.id,
          name: video.name,
          description: video.notes || '',
          pathology: pathologyKey,
          video_url: video.path,
          icon: pathologyIcons[pathologyKey] || '📝',
          media_ref: {
            type: 'bundled',
            id: video.id
          },
          media_name: video.name
        };

        const { data, error } = await client
          .from('exercises')
          .insert(exerciseData)
          .select()
          .single();

        if (error) {
          console.error(`  ❌ Error insertando ${video.name}:`, error.message);
          totalErrors++;
        } else {
          console.log(`  ✅ Insertado: ${video.name}`);
          totalInserted++;
        }
      } catch (err) {
        console.error(`  ❌ Excepción procesando ${video.name}:`, err.message);
        totalErrors++;
      }
    }
  }

  console.log('\n[init-exercises] ====== RESUMEN ======');
  console.log(`✅ Ejercicios insertados: ${totalInserted}`);
  console.log(`↪ Ejercicios omitidos (ya existían): ${totalSkipped}`);
  console.log(`❌ Errores: ${totalErrors}`);
  console.log(`📊 Total videos procesados: ${videos.length}`);
  console.log('[init-exercises] ✓ Migración completada');
})();
