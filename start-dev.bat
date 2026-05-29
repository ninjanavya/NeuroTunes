@echo off
echo ==========================================
echo   NeuroTunes Developer Setup & Launch
echo ==========================================
echo.

:: Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH. Please install Node.js first.
    pause
    exit /b 1
)

:: Check for Python
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH. Please install Python 3.9+ first.
    pause
    exit /b 1
)

echo [1/4] Installing root orchestrator dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install root dependencies.
    pause
    exit /b 1
)

echo.
echo [2/4] Installing backend and frontend package dependencies...
call npm run install:all
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install sub-project dependencies.
    pause
    exit /b 1
)

echo.
echo [3/4] Checking Python Virtual Environment...
if not exist .venv (
    echo Creating virtual environment...
    python -m venv .venv
)

echo Activating virtual environment and installing python dependencies...
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r ml-service/requirements.txt
if %errorlevel% neq 0 (
    echo [WARNING] Some python dependencies failed to install, check ml-service/requirements.txt
)

echo.
echo [4/4] Starting all servers concurrently (Next.js, Node.js, FastAPI)...
echo Click Ctrl+C in this terminal to stop all servers.
echo.
npm run dev

pause
