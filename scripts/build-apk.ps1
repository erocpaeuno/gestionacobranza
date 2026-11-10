$ErrorActionPreference = "Stop"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Generando APK de Gestion de Cobranzas y Pagos   " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Detectar JAVA_HOME
if (Test-Path "C:\Program Files\Android\Android Studio\jbr") {
    $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
} elseif (Test-Path "C:\Program Files\Android\openjdk\jdk-21.0.8") {
    $env:JAVA_HOME = "C:\Program Files\Android\openjdk\jdk-21.0.8"
}
Write-Host "Usando JAVA_HOME: $env:JAVA_HOME" -ForegroundColor DarkGray

# Paso 1: Compilar frontend y sincronizar con Capacitor
Write-Host "`n[1/2] Compilando frontend y sincronizando con Android..." -ForegroundColor Yellow
npm run build:android
if ($LASTEXITCODE -ne 0) {
    Write-Error "Fallo la compilacion con Vite / Capacitor"
}

# Paso 2: Compilar APK con Gradle
Write-Host "`n[2/2] Compilando APK con Gradle..." -ForegroundColor Yellow
Push-Location android
try {
    .\gradlew.bat assembleDebug
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Fallo la compilacion del APK en Gradle"
    }
} finally {
    Pop-Location
}

$apkPath = "android\app\build\outputs\apk\debug\app-debug.apk"
if (Test-Path $apkPath) {
    $apkItem = Get-Item $apkPath
    $sizeMb = [math]::Round($apkItem.Length / 1MB, 2)
    Write-Host "`n==================================================" -ForegroundColor Green
    Write-Host "  ¡APK generado con exito!" -ForegroundColor Green
    Write-Host "==================================================" -ForegroundColor Green
    Write-Host "Archivo: $apkPath ($sizeMb MB)" -ForegroundColor Green
    Write-Host "Ultima modificacion: $($apkItem.LastWriteTime)" -ForegroundColor Green
    Write-Host "==================================================" -ForegroundColor Green
}

