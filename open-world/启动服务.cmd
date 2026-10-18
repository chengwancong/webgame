@echo off
chcp 65001 >nul
cd /d "%~dp0"
node tools\local-service.mjs start
if errorlevel 1 pause
