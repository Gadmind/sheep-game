@echo off
cls
echo ============================================================
echo Sheep Game - Simple Server
echo ============================================================
echo.
echo Server starting on http://localhost:8000
echo.
echo Press Ctrl+C to stop
echo.
cd ..
python -m http.server 8000
pause
