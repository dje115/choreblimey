# ChoreBlimey Secure Stack Helper Script
# This script ensures you always use the correct docker-compose file

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('up', 'down', 'restart', 'logs', 'build', 'ps', 'exec')]
    [string]$Command,
    
    [Parameter(Mandatory=$false)]
    [string]$Service = "",
    
    [Parameter(Mandatory=$false)]
    [string]$ExecCommand = ""
)

$COMPOSE_FILE = "docker/docker-compose-secure.yml"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   ChoreBlimey SECURE Stack Manager" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Check if docker-compose-secure.yml exists
if (-not (Test-Path $COMPOSE_FILE)) {
    Write-Host "ERROR: $COMPOSE_FILE not found!" -ForegroundColor Red
    exit 1
}

Write-Host "Using compose file: $COMPOSE_FILE" -ForegroundColor Yellow
Write-Host ""

# Build the docker compose command
$dockerCmd = "docker compose -f $COMPOSE_FILE"

switch ($Command) {
    'up' {
        Write-Host "Starting the SECURE stack..." -ForegroundColor Green
        if ($Service) {
            & docker compose -f $COMPOSE_FILE up -d $Service
        } else {
            & docker compose -f $COMPOSE_FILE up -d
        }
    }
    'down' {
        Write-Host "Stopping the SECURE stack..." -ForegroundColor Yellow
        & docker compose -f $COMPOSE_FILE down
    }
    'restart' {
        Write-Host "Restarting service(s) in SECURE stack..." -ForegroundColor Yellow
        if ($Service) {
            & docker compose -f $COMPOSE_FILE restart $Service
        } else {
            & docker compose -f $COMPOSE_FILE restart
        }
    }
    'logs' {
        Write-Host "Showing logs for SECURE stack..." -ForegroundColor Cyan
        if ($Service) {
            & docker compose -f $COMPOSE_FILE logs -f $Service
        } else {
            & docker compose -f $COMPOSE_FILE logs -f
        }
    }
    'build' {
        Write-Host "Building service(s) in SECURE stack..." -ForegroundColor Green
        if ($Service) {
            & docker compose -f $COMPOSE_FILE build $Service
        } else {
            & docker compose -f $COMPOSE_FILE build
        }
    }
    'ps' {
        Write-Host "Listing SECURE stack containers..." -ForegroundColor Cyan
        & docker compose -f $COMPOSE_FILE ps
    }
    'exec' {
        if (-not $Service -or -not $ExecCommand) {
            Write-Host "ERROR: 'exec' requires -Service and -ExecCommand parameters" -ForegroundColor Red
            exit 1
        }
        Write-Host "Executing command in $Service..." -ForegroundColor Cyan
        & docker compose -f $COMPOSE_FILE exec $Service $ExecCommand
    }
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Verifying SECURE stack status..." -ForegroundColor Yellow
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Show running containers
Write-Host "Currently running containers:" -ForegroundColor Green
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | Select-String "choreblimey-secure"

Write-Host ""
Write-Host "✅ SECURE stack command completed!" -ForegroundColor Green

