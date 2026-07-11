@echo off
echo ===================================================
echo   Starting MarketOS Full Stack (Backend + Frontend)
echo ===================================================
echo.

echo [1/3] Starting Docker Backend Services (Port 3000 & 8000)...
cd /d "%~dp0marketos-backend"
docker compose up -d

echo.
echo [2/3] Waiting for Backend to be ready...
timeout /t 3 /nobreak >nul

echo.
echo [3/3] Launching Next.js Frontend Dev Server (Port 3001)...
echo A new terminal window will open for the Next.js dev server.
cd /d "%~dp0marketos-frontend\digital_marketing_agent-main"
start "MarketOS Frontend" cmd /k "npm run dev"

echo.
echo ===================================================
echo   MarketOS is starting up!
echo   Frontend will be available at: http://localhost:3001
echo   Backend API is available at:   http://localhost:3000
echo   Python AI Agents API at:       http://localhost:8000
echo ===================================================
echo.
pause
