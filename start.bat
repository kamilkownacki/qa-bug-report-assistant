@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo First run detected - starting setup...
    call setup.bat
    if errorlevel 1 exit /b 1
)

if not exist "frontend\node_modules" (
    echo Frontend dependencies are missing - starting setup...
    call setup.bat
    if errorlevel 1 exit /b 1
)

echo Starting QA Bug Report Assistant...

start "QA Bug Report Assistant - Backend" cmd /k "cd /d "%~dp0backend" && "%~dp0.venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"
start "QA Bug Report Assistant - Frontend" cmd /k "cd /d "%~dp0" && npm --prefix frontend run dev"

timeout /t 3 /nobreak >nul
start "" http://localhost:5173

endlocal
exit /b 0
