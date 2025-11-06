# Docker Setup Verification - v0.1.11

## Version Updates ✅

All version numbers have been updated to **0.1.11**:

- ✅ `VERSION` file: 0.1.11
- ✅ `web/package.json`: 0.1.11
- ✅ `docker/dev-secure.env`: APP_VERSION=0.1.11
- ✅ `docker/docker-compose-secure.yml`: All services updated to 0.1.11

## Volume Mounts Verification ✅

### ✅ API Service
- **Source Code Mount**: `../api:/app/api` 
  - ✅ Latest code changes will be reflected immediately
- **Node Modules**: `api_node_modules:/app/api/node_modules`
  - ✅ Preserves dependencies between restarts

### ✅ Web Service  
- **Source Code Mount**: `../web:/app/web`
  - ✅ Latest code changes will be reflected immediately (hot-reload enabled)
- **Node Modules**: `web_node_modules:/app/web/node_modules`
  - ✅ Preserves dependencies between restarts

### ✅ Worker Service
- **No source mount** (uses built image)
  - ⚠️ Requires rebuild to see changes
  - This is expected for worker services

### ✅ Admin API Service
- **Node Modules**: `admin_api_node_modules:/app/admin-api/node_modules`
  - ⚠️ No source mount - requires rebuild for code changes

### ✅ Admin Web Service
- **Node Modules**: `admin_web_node_modules:/app/admin-web/node_modules`
  - ⚠️ No source mount - uses production build with nginx

## How to Test Latest Code

### For Web App (Hot Reload Enabled):
1. Make changes to files in `web/src/`
2. Changes will be automatically detected by Vite
3. Browser will hot-reload automatically
4. **No restart needed!**

### For API (Requires Restart):
1. Make changes to files in `api/src/`
2. Restart the API container:
   ```bash
   docker compose -f docker/docker-compose-secure.yml --env-file docker/dev-secure.env restart api
   ```
3. Or rebuild if dependencies changed:
   ```bash
   docker compose -f docker/docker-compose-secure.yml --env-file docker/dev-secure.env up -d --build api
   ```

### For Worker (Requires Rebuild):
1. Make changes to files in `worker/src/`
2. Rebuild and restart:
   ```bash
   docker compose -f docker/docker-compose-secure.yml --env-file docker/dev-secure.env up -d --build worker
   ```

## Quick Commands

### Start Stack:
```bash
docker compose -f docker/docker-compose-secure.yml --env-file docker/dev-secure.env up --build -d
```

### View Logs:
```bash
# All services
docker compose -f docker/docker-compose-secure.yml --env-file docker/dev-secure.env logs -f

# Specific service
docker compose -f docker/docker-compose-secure.yml --env-file docker/dev-secure.env logs -f web
docker compose -f docker/docker-compose-secure.yml --env-file docker/dev-secure.env logs -f api
```

### Restart Service:
```bash
docker compose -f docker/docker-compose-secure.yml --env-file docker/dev-secure.env restart <service-name>
```

### Rebuild Service:
```bash
docker compose -f docker/docker-compose-secure.yml --env-file docker/dev-secure.env up -d --build <service-name>
```

### Check Running Containers:
```bash
docker compose -f docker/docker-compose-secure.yml --env-file docker/dev-secure.env ps
```

### Verify Version:
```bash
# Check container labels
docker inspect choreblimey-secure-web-1 | grep version
docker inspect choreblimey-secure-api-1 | grep version
```

## Confirming Latest Code is Running

### 1. Check Version in UI
- Open http://localhost:1500
- Version should show **v0.1.11** in the bottom right corner

### 2. Check Container Labels
```bash
docker inspect choreblimey-secure-web-1 --format='{{index .Config.Labels "com.choreblimey.version"}}'
# Should output: 0.1.11
```

### 3. Check Environment Variables
```bash
docker exec choreblimey-secure-api-1 env | grep APP_VERSION
# Should output: APP_VERSION=0.1.11
```

### 4. Test New Features
- The new `useRealtimeUpdates` hook should be working
- Error handling with `handleApiError` should be active
- Notification utilities should be functional

## Troubleshooting

### If changes aren't appearing:

1. **Web App**: 
   - Check Vite is running: `docker logs choreblimey-secure-web-1`
   - Check volume mount: `docker inspect choreblimey-secure-web-1 | grep Mounts`
   - Hard refresh browser (Ctrl+Shift+R)

2. **API**:
   - Restart container: `docker compose -f docker/docker-compose-secure.yml --env-file docker/dev-secure.env restart api`
   - Check logs for errors: `docker logs choreblimey-secure-api-1`

3. **Version not updating**:
   - Rebuild containers: `docker compose -f docker/docker-compose-secure.yml --env-file docker/dev-secure.env up -d --build`
   - Check environment file: `cat docker/dev-secure.env | grep APP_VERSION`

## Summary

✅ **Version**: Updated to 0.1.11 across all files
✅ **Web App**: Volume mounted - latest code with hot-reload
✅ **API**: Volume mounted - latest code (restart required)
✅ **Docker Compose**: All services configured correctly

**Docker is ready to run the latest code!**

