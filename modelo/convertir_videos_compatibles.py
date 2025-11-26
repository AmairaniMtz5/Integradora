"""
Script para convertir videos a formato compatible con dispositivos móviles
Codec: H.264 baseline profile level 3.0, resolución 640x480, 30fps
Usa ffmpeg para máxima compatibilidad con Android/iOS
"""
import subprocess
import os
from pathlib import Path
import shutil

def check_ffmpeg():
    """Verifica si ffmpeg está disponible."""
    return shutil.which('ffmpeg') is not None

def convert_video_to_mobile_compatible(input_path, output_path, target_width=640, target_fps=30):
    """
    Convierte un video a formato compatible con móviles usando ffmpeg.
    
    Args:
        input_path: Ruta del video original
        output_path: Ruta donde guardar el video convertido
        target_width: Ancho objetivo (altura se calcula manteniendo aspect ratio)
        target_fps: FPS objetivo
    """
    print(f"Convirtiendo: {input_path.name}")
    
    # Crear directorio de salida si no existe
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Comando ffmpeg optimizado para máxima compatibilidad móvil
    # - libx264: codec H.264
    # - baseline profile level 3.0: máxima compatibilidad
    # - yuv420p: espacio de color compatible
    # - moov_size: optimiza para streaming
    # - preset fast: balance entre velocidad y compresión
    cmd = [
        'ffmpeg',
        '-i', str(input_path),
        '-c:v', 'libx264',              # Codec H.264
        '-profile:v', 'baseline',        # Perfil baseline (máxima compatibilidad)
        '-level', '3.0',                 # Level 3.0 (compatible con dispositivos antiguos)
        '-pix_fmt', 'yuv420p',           # Formato de pixel compatible
        '-vf', f'scale={target_width}:-2', # Escalar a ancho objetivo, altura automática (par)
        '-r', str(target_fps),           # Frame rate
        '-movflags', '+faststart',       # Optimizar para streaming
        '-preset', 'fast',               # Velocidad de encoding
        '-crf', '23',                    # Calidad (18-28, menor=mejor calidad)
        '-maxrate', '2M',                # Bitrate máximo 2Mbps
        '-bufsize', '4M',                # Buffer size
        '-c:a', 'aac',                   # Codec de audio AAC
        '-b:a', '128k',                  # Bitrate de audio
        '-ar', '44100',                  # Sample rate de audio
        '-ac', '2',                      # Canales de audio (stereo)
        '-y',                            # Sobrescribir sin preguntar
        str(output_path)
    ]
    
    try:
        # Ejecutar ffmpeg capturando la salida
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=True
        )
        
        print(f"  ✓ Completado exitosamente")
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"  ✗ Error en la conversión:")
        print(f"  {e.stderr}")
        return False
    except Exception as e:
        print(f"  ✗ Error inesperado: {e}")
        return False

def convert_all_videos(source_dir, output_dir):
    """
    Convierte todos los videos en un directorio y sus subdirectorios.
    
    Args:
        source_dir: Directorio con videos originales
        output_dir: Directorio donde guardar videos convertidos
    """
    source_path = Path(source_dir)
    output_path = Path(output_dir)
    
    if not source_path.exists():
        print(f"Error: {source_dir} no existe")
        return
    
    # Buscar todos los archivos .mp4
    video_files = list(source_path.rglob('*.mp4'))
    
    if not video_files:
        print(f"No se encontraron videos .mp4 en {source_dir}")
        return
    
    print(f"Encontrados {len(video_files)} videos para convertir\n")
    
    successful = 0
    failed = 0
    
    for video_file in video_files:
        # Mantener la estructura de subdirectorios
        relative_path = video_file.relative_to(source_path)
        output_file = output_path / relative_path
        
        # Saltar si ya existe
        if output_file.exists():
            print(f"Saltando (ya existe): {relative_path}")
            continue
        
        try:
            if convert_video_to_mobile_compatible(video_file, output_file):
                successful += 1
            else:
                failed += 1
        except Exception as e:
            print(f"  ✗ Error inesperado: {e}")
            failed += 1
        
        print()  # Línea en blanco entre conversiones
    
    print(f"\n{'='*60}")
    print(f"Conversión completada:")
    print(f"  ✓ Exitosos: {successful}")
    print(f"  ✗ Fallidos: {failed}")
    print(f"  Total: {len(video_files)}")
    print(f"{'='*60}")

if __name__ == '__main__':
    import sys
    
    # Verificar que ffmpeg esté disponible
    if not check_ffmpeg():
        print("="*60)
        print("ERROR: ffmpeg no está instalado o no está en el PATH")
        print("="*60)
        print("\nPara instalar ffmpeg:")
        print("1. Descarga ffmpeg desde: https://ffmpeg.org/download.html")
        print("2. O instala con chocolatey: choco install ffmpeg")
        print("3. O instala con scoop: scoop install ffmpeg")
        print("\nAsegúrate de que ffmpeg esté en tu PATH del sistema.")
        exit(1)
    
    # Determinar modo de operación
    if len(sys.argv) > 1 and sys.argv[1] == '--servidor':
        # Modo servidor: convertir videos del dataset (sobrescribiendo originales)
        source_directory = Path('dataset')
        output_directory = Path('dataset_converted_temp')
        
        print("="*60)
        print("CONVERTIDOR DE VIDEOS PARA SERVIDOR")
        print("="*60)
        print(f"Origen: {source_directory.absolute()}")
        print(f"Temporal: {output_directory.absolute()}")
        print("Formato: H.264 baseline level 3.0, 640x480, 30fps")
        print("NOTA: Los videos originales serán reemplazados")
        print("="*60)
        print()
        
        # Convertir a directorio temporal
        convert_all_videos(source_directory, output_directory)
        
        # Reemplazar originales con convertidos
        print("\nReemplazando videos originales con versiones convertidas...")
        import shutil
        for converted_file in output_directory.rglob('*.mp4'):
            relative_path = converted_file.relative_to(output_directory)
            original_file = source_directory / relative_path
            
            # Hacer backup del original
            backup_file = original_file.with_suffix('.mp4.bak')
            if original_file.exists():
                shutil.copy2(original_file, backup_file)
                print(f"  Backup: {relative_path}.bak")
            
            # Reemplazar con convertido
            shutil.copy2(converted_file, original_file)
            print(f"  ✓ Reemplazado: {relative_path}")
        
        # Limpiar directorio temporal
        shutil.rmtree(output_directory)
        print("\n✓ Conversión completada. Videos originales respaldados con extensión .bak")
        
    else:
        # Modo app móvil: convertir videos a assets de la app
        source_directory = Path('dataset')
        output_directory = Path('../app_movil/assets/videos_compatible')
        
        print("="*60)
        print("CONVERTIDOR DE VIDEOS A FORMATO COMPATIBLE MÓVIL")
        print("="*60)
        print(f"Origen: {source_directory.absolute()}")
        print(f"Destino: {output_directory.absolute()}")
        print("Formato: H.264 baseline level 3.0, 640x480, 30fps")
        print("="*60)
        print()
        
        convert_all_videos(source_directory, output_directory)
