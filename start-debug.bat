@echo off
chcp 936 >nul
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\start-debug.ps1"
