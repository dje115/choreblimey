# 🧩 ChoreBlimey! v1.4.1 Setup (YAML fixed, Cursor-friendly TS)

**Containers named via Compose:** `name: choreblimey` → containers like `choreblimey_api_1`

## Validate YAML (recommended)
```powershell
docker compose -f docker\docker-compose.yml config
```

## Start stack
```powershell
docker compose -f docker\docker-compose.yml --env-file docker\dev.env up --build
```

## Initialise DB (inside container)
```powershell
docker compose -f docker\docker-compose.yml exec api npx prisma migrate dev
docker compose -f docker\docker-compose.yml exec api npm run seed
```

## Clean only old 'docker_*' containers
```powershell
docker compose -f docker\docker-compose.yml --project-name docker down --remove-orphans
# add -v if you want to wipe its volumes:
# docker compose -f docker\docker-compose.yml --project-name docker down -v --remove-orphans
```

## Health checks
- `check_stack.ps1` (PowerShell)
- `check_stack.bat` (Windows CMD)
- `./check_stack.sh` (macOS/Linux)
