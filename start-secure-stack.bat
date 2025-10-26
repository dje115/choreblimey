@echo off
echo 🛡️ Starting ChoreBlimey Secure Architecture...
echo.

echo 📋 Checking prerequisites...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not installed or not running
    pause
    exit /b 1
)

echo ✅ Docker is available

echo.
echo 🏗️ Building secure containers...
docker compose -f docker/docker-compose-secure.yml --env-file docker/dev-secure.env build

if %errorlevel% neq 0 (
    echo ❌ Failed to build containers
    pause
    exit /b 1
)

echo.
echo 🚀 Starting secure services...
docker compose -f docker/docker-compose-secure.yml --env-file docker/dev-secure.env up -d

if %errorlevel% neq 0 (
    echo ❌ Failed to start services
    pause
    exit /b 1
)

echo.
echo ⏳ Waiting for services to be ready...
timeout /t 10 /nobreak >nul

echo.
echo 🔍 Checking service health...

echo 📊 User Services:
curl -s http://localhost:1500 >nul 2>&1 && echo ✅ Web App (Port 1500) || echo ❌ Web App (Port 1500)
curl -s http://localhost:1501/health >nul 2>&1 && echo ✅ User API (Port 1501) || echo ❌ User API (Port 1501)

echo.
echo 🛡️ Admin Services:
curl -s http://localhost:1502/health >nul 2>&1 && echo ✅ Admin API (Port 1502) || echo ❌ Admin API (Port 1502)
curl -s http://localhost:1503 >nul 2>&1 && echo ✅ Admin Web (Port 1503) || echo ❌ Admin Web (Port 1503)

echo.
echo 🗄️ Database Services:
curl -s http://localhost:1502/health >nul 2>&1 && echo ✅ PostgreSQL (Port 1502) || echo ❌ PostgreSQL (Port 1502)
curl -s http://localhost:1507 >nul 2>&1 && echo ✅ Redis (Port 1507) || echo ❌ Redis (Port 1507)

echo.
echo 📧 Email Services:
curl -s http://localhost:1506 >nul 2>&1 && echo ✅ MailHog (Port 1506) || echo ❌ MailHog (Port 1506)

echo.
echo 🎉 Secure ChoreBlimey Stack Started!
echo.
echo 🌐 Access Points:
echo    👥 User App:     http://localhost:1500
echo    🔧 User API:     http://localhost:1501
echo    🛡️ Admin Web:    http://localhost:1503
echo    🔧 Admin API:    http://localhost:1502
echo    📧 MailHog:      http://localhost:1506
echo.
echo 🔒 Security Features:
echo    ✅ Network isolation between user and admin services
echo    ✅ Separate authentication systems
echo    ✅ Enhanced admin security with 2FA
echo    ✅ Comprehensive audit logging
echo    ✅ IP whitelisting and session management
echo.
echo 📊 To view logs: docker compose -f docker/docker-compose-secure.yml logs -f
echo 🛑 To stop: docker compose -f docker/docker-compose-secure.yml down
echo.
pause

