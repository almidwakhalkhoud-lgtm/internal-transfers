@echo off
setlocal
cd /d "%~dp0"
python "tools\qbm-recorder\recorder.py"
if errorlevel 1 pause
