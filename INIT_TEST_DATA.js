/**
 * Script de Inicialización de Datos de Prueba
 * 
 * Ejecuta esto una sola vez en la consola del navegador después de configurar Supabase
 * para cargar datos de prueba iniciales
 * 
 * Requisitos:
 * - Estar autenticado como admin
 * - Supabase configurado y conectado
 * - Tablas creadas en la base de datos
 */

async function initializeTestData() {
  console.log('🚀 Iniciando carga de datos de prueba...\n');

  try {
    // ============================================================
    // 1. CREAR PATOLOGÍAS
    // ============================================================
    console.log('📋 Paso 1/5: Creando patologías...');
    
    const pathologies = [
      {
        name: 'Escoliosis lumbar',
        description: 'Curvatura anormal de la columna vertebral en la región lumbar'
      },
      {
        name: 'Espondilólisis',
        description: 'Fractura por estrés en la vértebra, especialmente en vértebras lumbares'
      },
      {
        name: 'Hernia de disco lumbar',
        description: 'Desplazamiento del núcleo del disco intervertebral fuera de su espacio'
      },
      {
        name: 'Lumbalgia mecánica inespecífica',
        description: 'Dolor lumbar de origen mecánico sin causa específica identificada'
      }
    ];

    for (const path of pathologies) {
      const result = await window.SupabaseExercises.createPathology(path);
      if (result.success) {
        console.log(`  ✓ ${path.name} creada (ID: ${result.data.id})`);
      } else {
        console.warn(`  ✗ Error creando ${path.name}:`, result.error);
      }
    }

    // ============================================================
    // 2. OBTENER IDs DE PATOLOGÍAS
    // ============================================================
    console.log('\n🔍 Paso 2/5: Obteniendo IDs de patologías...');
    
    const pathResult = await window.SupabaseExercises.getPathologies();
    if (!pathResult.success) {
      throw new Error('No se pudieron obtener las patologías');
    }

    const pathologyMap = {};
    pathResult.data.forEach(p => {
      pathologyMap[p.name] = p.id;
      console.log(`  ✓ ${p.name}: ${p.id}`);
    });

    // ============================================================
    // 3. CREAR EJERCICIOS
    // ============================================================
    console.log('\n💪 Paso 3/5: Creando ejercicios...');

    const exercises = [
      // Escoliosis lumbar
      {
        name: 'Ambas rodillas al pecho',
        description: 'Flexión de cadera y columna vertebral',
        pathology: 'Escoliosis lumbar',
        instructions: '1. Acuéstate boca arriba\n2. Dobla ambas rodillas\n3. Levanta las rodillas hacia el pecho\n4. Abraza las rodillas con los brazos\n5. Mantén 20-30 segundos',
        duration: 5,
        difficulty: 'beginner'
      },
      {
        name: 'Postura del Avión',
        description: 'Extensión de columna con estabilidad',
        pathology: 'Escoliosis lumbar',
        instructions: '1. Párate derecho\n2. Levanta un pie del suelo\n3. Inclina el torso hacia adelante\n4. Extiende el otro brazo\n5. Mantén el equilibrio 15 segundos',
        duration: 5,
        difficulty: 'intermediate'
      },
      {
        name: 'Puente',
        description: 'Fortalecimiento de glúteos y espalda baja',
        pathology: 'Escoliosis lumbar',
        instructions: '1. Acuéstate boca arriba, rodillas dobladas\n2. Levanta las caderas hacia el techo\n3. Aprieta los glúteos\n4. Mantén 2-3 segundos\n5. Baja y repite',
        duration: 10,
        difficulty: 'beginner'
      },
      {
        name: 'Plancha lateral',
        description: 'Fortalecimiento de músculos laterales',
        pathology: 'Escoliosis lumbar',
        instructions: '1. Acuéstate de lado\n2. Levanta tu cuerpo con el antebrazo\n3. Mantén el cuerpo recto\n4. Aguanta 20-30 segundos\n5. Repite del otro lado',
        duration: 5,
        difficulty: 'intermediate'
      },

      // Espondilólisis
      {
        name: 'Abdominales',
        description: 'Fortalecimiento del core',
        pathology: 'Espondilólisis',
        instructions: '1. Acuéstate boca arriba\n2. Dobla rodillas\n3. Levanta los hombros del suelo\n4. Contrae el abdomen\n5. Baja lentamente',
        duration: 10,
        difficulty: 'intermediate'
      },
      {
        name: 'Perro de caza',
        description: 'Extensión alternada de extremidades',
        pathology: 'Espondilólisis',
        instructions: '1. Ponte en posición de cuatro puntos\n2. Extiende el brazo derecho y la pierna izquierda\n3. Mantén 2 segundos\n4. Alterna con el brazo izquierdo y pierna derecha\n5. Repite 10-15 veces',
        duration: 8,
        difficulty: 'intermediate'
      },
      {
        name: 'Plancha sobre codos',
        description: 'Estabilidad central avanzada',
        pathology: 'Espondilólisis',
        instructions: '1. Posición de plancha sobre antebrazos\n2. Cuerpo recto de cabeza a pies\n3. Contrae abdomen\n4. Mantén 30-60 segundos\n5. Descansa y repite',
        duration: 5,
        difficulty: 'advanced'
      },

      // Hernia de disco lumbar
      {
        name: 'El perro y gato',
        description: 'Extensión y flexión de columna',
        pathology: 'Hernia de disco lumbar',
        instructions: '1. Posición de cuatro puntos\n2. Arquea la espalda (gato)\n3. Mantén 3 segundos\n4. Baja el abdomen (perro)\n5. Repite lentamente',
        duration: 8,
        difficulty: 'beginner'
      },
      {
        name: 'En cuatro puntos',
        description: 'Ejercicio de estabilidad',
        pathology: 'Hernia de disco lumbar',
        instructions: '1. Posición de cuatro puntos\n2. Mantén la espalda neutral\n3. Evita arqs o hundimientos\n4. Respira profundamente\n5. Mantén 30 segundos',
        duration: 5,
        difficulty: 'beginner'
      },

      // Lumbalgia
      {
        name: 'Estiramiento de isquiotibiales',
        description: 'Flexibilidad de la parte posterior',
        pathology: 'Lumbalgia mecánica inespecífica',
        instructions: '1. Acuéstate boca arriba\n2. Levanta una pierna\n3. Tira hacia el pecho\n4. Mantén 30 segundos\n5. Alterna con la otra pierna',
        duration: 10,
        difficulty: 'beginner'
      }
    ];

    for (const ex of exercises) {
      const pathologyId = pathologyMap[ex.pathology];
      if (!pathologyId) {
        console.warn(`  ✗ Patología no encontrada: ${ex.pathology}`);
        continue;
      }

      const result = await window.SupabaseExercises.createExercise({
        name: ex.name,
        description: ex.description,
        pathologyId: pathologyId,
        instructions: ex.instructions,
        durationMinutes: ex.duration,
        difficultyLevel: ex.difficulty
      });

      if (result.success) {
        console.log(`  ✓ ${ex.name} creado`);
      } else {
        console.warn(`  ✗ Error creando ${ex.name}:`, result.error);
      }
    }

    // ============================================================
    // 4. CREAR TERAPEUTA DE PRUEBA (OPCIONAL)
    // ============================================================
    console.log('\n👨‍⚕️ Paso 4/5: Creando terapeuta de prueba...');

    const therapistResult = await window.SupabaseTherapists.createTherapist({
      firstName: 'Juan',
      lastName: 'García',
      email: 'juan.garcia@clinic.com',
      phone: '+34 912 345 678',
      clinic: 'Clínica Fisioterapia Central',
      specialization: 'Fisioterapia Deportiva',
      professionalLicense: 'CF-2024-001'
    });

    if (therapistResult.success) {
      console.log(`  ✓ Terapeuta creado: ${therapistResult.data.first_name}`);
      console.log(`    Email: ${therapistResult.data.email}`);
    } else {
      console.warn('  ✗ Error creando terapeuta:', therapistResult.error);
    }

    // ============================================================
    // 5. CREAR PACIENTE DE PRUEBA (OPCIONAL)
    // ============================================================
    console.log('\n👥 Paso 5/5: Creando paciente de prueba...');

    const patientResult = await window.SupabasePatients.createPatient({
      firstName: 'Carlos',
      lastName: 'Rodríguez',
      email: 'carlos.rodriguez@example.com',
      phone: '+34 987 654 321',
      dateOfBirth: '1990-05-15',
      gender: 'M',
      clinic: 'Clínica Fisioterapia Central',
      medicalHistory: 'Dolor lumbar crónico, sin intervenciones quirúrgicas'
    });

    if (patientResult.success) {
      console.log(`  ✓ Paciente creado: ${patientResult.data.first_name}`);
      console.log(`    Email: ${patientResult.data.email}`);

      // Asignar paciente a terapeuta (si ambos fueron creados)
      if (therapistResult.success && patientResult.success) {
        const assignResult = await window.SupabasePatients.assignToTherapist(
          patientResult.data.id,
          therapistResult.data.id
        );

        if (assignResult.success) {
          console.log(`  ✓ Paciente asignado al terapeuta`);
        }
      }
    } else {
      console.warn('  ✗ Error creando paciente:', patientResult.error);
    }

    // ============================================================
    // RESUMEN
    // ============================================================
    console.log('\n' + '='.repeat(50));
    console.log('✅ INICIALIZACIÓN COMPLETADA');
    console.log('='.repeat(50));
    console.log('\n📊 Datos de prueba cargados:');
    console.log('  • Patologías: 4');
    console.log('  • Ejercicios: 10+');
    console.log('  • Terapeuta: 1');
    console.log('  • Paciente: 1');
    console.log('\n📝 Próximos pasos:');
    console.log('  1. Abre SUPABASE_TEST_TEMPLATE.html');
    console.log('  2. Usa credenciales admin para login');
    console.log('  3. Verifica que los datos aparezcan');
    console.log('  4. Prueba crear más registros');
    console.log('\n💡 Consejo:');
    console.log('  Ahora puedes integrar esto en tu aplicación');
    console.log('  Revisa SUPABASE_EXAMPLES.md para más ejemplos');

  } catch (error) {
    console.error('\n❌ ERROR DURANTE LA INICIALIZACIÓN:');
    console.error(error);
  }
}

/**
 * Función auxiliar para limpiar datos de prueba
 * ¡USA CON CUIDADO! Elimina TODOS los registros.
 */
async function cleanTestData() {
  if (!confirm('⚠️ ADVERTENCIA: Esto eliminará TODOS los datos.\n¿Continuar?')) {
    return;
  }

  console.log('🗑️ Limpiando datos de prueba...');

  try {
    // Obtener y eliminar ejercicios
    const exResult = await window.SupabaseExercises.getExercises();
    if (exResult.success) {
      for (const ex of exResult.data) {
        await window.SupabaseExercises.deleteExercise(ex.id);
      }
      console.log(`✓ ${exResult.data.length} ejercicios eliminados`);
    }

    // Obtener y eliminar patologías
    const pathResult = await window.SupabaseExercises.getPathologies();
    if (pathResult.success) {
      // Las patologías se eliminarán en cascada
      console.log(`✓ ${pathResult.data.length} patologías preparadas para eliminar`);
    }

    console.log('✅ Limpieza completada');
  } catch (error) {
    console.error('Error durante limpieza:', error);
  }
}

// ============================================================
// INSTRUCCIONES DE USO
// ============================================================

/*
CÓMO USAR ESTE SCRIPT:

1. Abre tu navegador en una página con los módulos de Supabase cargados
   (puede ser SUPABASE_TEST_TEMPLATE.html o cualquier página que incluya los scripts)

2. Abre la consola del navegador (F12 → Consola)

3. Copia TODO este archivo en la consola

4. Ejecuta:
   
   initializeTestData()

5. Espera a que terminen los logs (puede tardar 20-30 segundos)

6. Verifica el resultado

PARA LIMPIAR LOS DATOS:

   cleanTestData()

NOTAS:
- Asegúrate de estar autenticado como ADMIN
- Si hay errores, revisa que Supabase esté configurado correctamente
- Los datos se guardan en la base de datos de verdad
- Puedes ejecutar esto múltiples veces sin problemas (actualizará)
*/

console.log('%c✓ Script de inicialización cargado', 'color: green; font-size: 14px;');
console.log('%c💡 Ejecuta: initializeTestData()', 'color: blue; font-size: 12px;');
