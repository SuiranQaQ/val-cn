@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-ca.ps1"
exit /b %ERRORLEVEL%
