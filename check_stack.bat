@echo off
echo ============================================================
echo    ChoreBlimey! Docker Stack - Quick Health Check
echo ============================================================
echo.

echo Containers:
docker ps --format "table {{.Names}}	{{.Status}}	{{.Ports}}"
echo.

setlocal enabledelayedexpansion
set SERVICES=postgres redis api web minio mailhog

for %%S in (%SERVICES%) do (
    echo - Checking %%S:
    docker compose -f docker\docker-compose.yml ps %%S
    echo.
)

echo ============================================================
echo  Open these in your browser:
echo    Web     -> http://localhost:1500
echo    API     -> http://localhost:1501/v1/health
echo    MailHog -> http://localhost:1506
echo    MinIO   -> http://localhost:1505
echo ============================================================

pause
