# MarketOS One-Click Startup Script (PowerShell)
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  Starting MarketOS Full Stack (Backend + Frontend)" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/3] Starting Docker Backend Services (Port 3000 & 8000)..." -ForegroundColor Yellow
Set-Location "$PSScriptRoot\marketos-backend"
docker compose up -d

Write-Host "`n[2/3] Waiting 3 seconds for Backend containers..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

Write-Host "`n[3/3] Launching Next.js Frontend Dev Server..." -ForegroundColor Yellow
Set-Location "$PSScriptRoot\marketos-frontend\digital_marketing_agent-main"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev"

Write-Host "`n===================================================" -ForegroundColor Green
Write-Host "  MarketOS startup initiated successfully!" -ForegroundColor Green
Write-Host "  👉 Frontend Web App: http://localhost:3001" -ForegroundColor White
Write-Host "  👉 Node.js API:      http://localhost:3000" -ForegroundColor White
Write-Host "  👉 Python AI Agents: http://localhost:8000" -ForegroundColor White
Write-Host "===================================================" -ForegroundColor Green
