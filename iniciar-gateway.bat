@echo off
title INFINDA - WhatsApp Gateway
color 0A
echo ========================================================
echo   INFINDA WhatsApp Gateway - Disparador Silencioso
echo ========================================================
echo.
echo Iniciando gateway de conexao com WhatsApp...
cd /d "%~dp0"
node gateway/server.mjs
pause
