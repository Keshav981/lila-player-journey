@echo off
title LILA BLACK - Setup and Run
color 0B

echo.
echo ================================================
echo   LILA BLACK - Player Journey Visualizer
echo ================================================
echo.

:: Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is NOT installed!
    echo.
    echo Please download and install Node.js from:
    echo   https://nodejs.org
    echo.
    echo Then run this file again.
    pause
    exit /b 1
)
echo [OK] Node.js found: 
node --version

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is NOT installed!
    echo.
    echo Please download and install Python from:
    echo   https://python.org
    echo.
    echo Then run this file again.
    pause
    exit /b 1
)
echo [OK] Python found:
python --version

echo.
echo ================================================
echo   STEP 1: Installing Python packages...
echo ================================================
pip install pandas pyarrow --quiet
echo [OK] Python packages ready

echo.
echo ================================================
echo   STEP 2: Converting your player data...
echo ================================================
echo.

:: Check if data.json already exists
if exist "public\data.json" (
    echo [OK] data.json already exists - skipping conversion
    goto INSTALL_NODE
)

:: Ask user for player_data path
echo Please paste the full path to your player_data folder below.
echo Example: C:\Users\Keshav\Downloads\player_data
echo.
set /p DATA_PATH="Path to player_data folder: "

if not exist "%DATA_PATH%" (
    echo [ERROR] That folder was not found: %DATA_PATH%
    echo Please check the path and try again.
    pause
    exit /b 1
)

python scripts\convert_data.py --input "%DATA_PATH%" --output "public\data.json"
if errorlevel 1 (
    echo [ERROR] Data conversion failed. Check the path and try again.
    pause
    exit /b 1
)
echo [OK] Data converted successfully!

:INSTALL_NODE
echo.
echo ================================================
echo   STEP 3: Installing React packages...
echo ================================================
call npm install
if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
)
echo [OK] React packages installed

echo.
echo ================================================
echo   STEP 4: Starting the app...
echo ================================================
echo.
echo The app will open in your browser automatically.
echo When you want to stop it, press Ctrl+C here.
echo.
call npm start
pause
