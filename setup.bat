@echo off
setlocal
cd /d "%~dp0"

echo ==========================================
echo QA Bug Report Assistant - Setup
echo ==========================================
echo.

where python >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Python was not found.
    echo Install Python 3.12 or newer and make sure it is available in PATH.
    pause
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] npm was not found.
    echo Install Node.js 22.12 or newer and try again.
    pause
    exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
    echo [1/3] Creating Python virtual environment...
    python -m venv .venv
    if errorlevel 1 goto :error
) else (
    echo [1/3] Python virtual environment already exists.
)

echo [2/3] Installing backend dependencies...
".venv\Scripts\python.exe" -m pip install -r backend\requirements.lock
if errorlevel 1 goto :error

echo [3/3] Installing frontend dependencies...
call npm --prefix frontend ci
if errorlevel 1 goto :error

echo.
echo Setup complete.
echo Run start.bat to start the application.
echo.
pause
endlocal
exit /b 0

:error
echo.
echo [ERROR] Setup failed. Check the message above.
pause
endlocal
exit /b 1
