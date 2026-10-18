@echo off
chcp 65001 >nul
cd /d "%~dp0"
node tools\local-service.mjs restart
if errorlevel 1 pause
