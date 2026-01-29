@echo off
cls

echo ============================================================
echo Sheep Game - Local Server Starter
echo ============================================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Python detected
    echo [INFO] Starting server with Python...
    echo.
    cd ..
    python server.py
    goto :end
)

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Node.js detected
    echo [INFO] Starting server with Node.js...
    echo.
    cd ..
    node server.js
    goto :end
)

REM If neither is available, open directly in browser
echo [WARNING] Python or Node.js not detected
echo [INFO] Opening index.html directly in browser...
echo.
cd ..
start index.html

:end
pause
