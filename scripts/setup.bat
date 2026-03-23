@echo off
REM Kwitt Setup Script for Windows

echo.
echo ========================================
echo   🚀 Kwitt Setup - Windows
echo ========================================
echo.

echo 📦 Installing dependencies...

echo.
echo 📦 Installing backend dependencies...
cd backend
call npm install
cd ..

echo.
echo 📦 Installing frontend dependencies...
cd frontend
call npm install
cd ..

echo.
echo 📦 Installing bot dependencies...
cd bot
call npm install
cd ..

echo.
echo ✅ Setup complete!
echo.
echo ========================================
echo   Usage:
echo.
echo   Start all:   make dev
echo   Backend:     make backend
echo   Frontend:    make frontend  
echo   Bot:         make bot
echo.
echo   Or use Docker:
echo   docker-compose -f infra/docker-compose.yml up -d
echo ========================================
echo.

pause