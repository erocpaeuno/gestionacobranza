@echo off
setlocal
echo ==================================================
echo   Generando APK de Gestion de Cobranzas y Pagos
echo ==================================================

if exist "C:\Program Files\Android\Android Studio\jbr" (
    set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
) else if exist "C:\Program Files\Android\openjdk\jdk-21.0.8" (
    set "JAVA_HOME=C:\Program Files\Android\openjdk\jdk-21.0.8"
)

echo [1/3] Compilando frontend y sincronizando con Android...
call npm run build:android
if errorlevel 1 (
    echo [ERROR] Fallo la compilacion con Vite o Capacitor.
    pause
    exit /b %errorlevel%
)

echo [2/3] Compilando APK con Gradle...
cd android
call gradlew.bat assembleDebug
if errorlevel 1 (
    echo [ERROR] Fallo la compilacion del APK en Gradle.
    cd ..
    pause
    exit /b %errorlevel%
)
cd ..

echo ==================================================
echo   ¡APK generado con exito!
echo ==================================================
echo Archivo: android\app\build\outputs\apk\debug\app-debug.apk
echo ==================================================
pause
