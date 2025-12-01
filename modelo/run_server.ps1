# Script para arrancar el backend con configuración correcta
# Uso: .\run_server.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Backend Modelo - Proyecto Integrador" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Suprimir warnings de TensorFlow
$env:TF_CPP_MIN_LOG_LEVEL = "2"
$env:TF_ENABLE_ONEDNN_OPTS = "0"

Write-Host "[INFO] Variables de entorno configuradas" -ForegroundColor Green
Write-Host "[INFO] Iniciando servidor en http://0.0.0.0:5000" -ForegroundColor Green
Write-Host "[INFO] Presiona Ctrl+C para detener" -ForegroundColor Yellow
Write-Host ""

# Ejecutar app.py
python app.py
