@echo off
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\build-apk.ps1"
if "%CI%"=="" if not "%NOPAUSE%"=="1" pause
