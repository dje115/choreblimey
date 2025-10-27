# 🐳 Docker Development Guide

## 🚨 **CRITICAL: Development Platform Setup**

**ChoreBlimey uses TWO Docker Compose stacks:**

### 1. **`choreblimey-secure`** - **CURRENT PRODUCTION STACK** ✅
- **File**: `docker/docker-compose-secure.yml`
- **Environment**: `docker/dev-secure.env`
- **Architecture**: Split admin/user services
- **Status**: **ACTIVE DEVELOPMENT STACK**

### 2. **`choreblimey`** - **LEGACY STACK** ❌
- **File**: `docker/docker-compose.yml`
- **Environment**: `docker/dev.env`
- **Architecture**: Monolithic services
- **Status**: **DEPRECATED - DO NOT USE**

## 🎯 **Quick Start Commands**

### Start Development Environment
```bash
# Start the secure stack (CURRENT)
docker compose -f docker/docker-compose-secure.yml --env-file docker/dev-secure.env up --build -d

# Check status
docker ps | grep choreblimey-secure
```

### Database Operations
```bash
# Run migrations
docker exec choreblimey-secure-api-1 npx prisma migrate dev --name <migration-name>

# Reset database (WARNING: DESTROYS ALL DATA)
docker exec choreblimey-secure-api-1 npx prisma migrate reset --force

# Seed database
docker exec choreblimey-secure-api-1 npm run seed

# Generate Prisma client
docker exec choreblimey-secure-api-1 npx prisma generate
```

### Worker Operations
```bash
# Check worker logs
docker logs choreblimey-secure-worker-1 --tail 20

# Rebuild worker (after schema changes)
docker compose -f docker/docker-compose-secure.yml build worker
docker compose -f docker/docker-compose-secure.yml up worker -d

# Test chore generation manually
docker exec choreblimey-secure-worker-1 node -e "
const { Queue } = require('bullmq');
const queue = new Queue('chore-generation', { connection: { host: 'redis', port: 6379 } });
queue.add('manual-test', {}, { priority: 1 }).then(job => console.log('Job added:', job.id));
"
```

## 🏗️ **Architecture Overview**

### Secure Stack Services
```
choreblimey-secure-api-1        # Main API (Port 1501)
choreblimey-secure-admin-api-1  # Admin API (Port 1502)
choreblimey-secure-web-1        # User Web App (Port 1500)
choreblimey-secure-admin-web-1  # Admin Portal (Port 1503)
choreblimey-secure-worker-1     # Background Jobs
choreblimey-secure-postgres-1   # Database (Port 1504)
choreblimey-secure-redis-1      # Cache/Queue (Port 1505)
choreblimey-secure-mailhog-1    # Email Testing (Port 1506)
```

### Networks
- `choreblimey-secure_admin_network` - Admin services
- `choreblimey-secure_user_network` - User services
- `choreblimey-secure_database_network` - Database services
- `choreblimey-secure_shared_network` - Shared services

## 🔧 **Common Issues & Solutions**

### Issue: "Unknown argument `paused`" Error
**Cause**: Worker container has outdated Prisma schema
**Solution**:
```bash
# Copy updated schema from API to worker
docker cp choreblimey-secure-api-1:/app/api/prisma/schema.prisma ./temp-schema.prisma
docker cp ./temp-schema.prisma choreblimey-secure-worker-1:/app/worker/prisma/schema.prisma
docker exec choreblimey-secure-worker-1 npx prisma generate
docker restart choreblimey-secure-worker-1
rm ./temp-schema.prisma
```

### Issue: Migration Drift
**Cause**: Database schema out of sync with migration files
**Solution**:
```bash
# Reset database (DESTROYS ALL DATA)
docker exec choreblimey-secure-api-1 npx prisma migrate reset --force
docker exec choreblimey-secure-api-1 npm run seed
```

### Issue: Docker Desktop Connection Errors
**Cause**: Docker Desktop not running or corrupted
**Solution**:
```bash
# Kill Docker Desktop processes
taskkill /F /IM "Docker Desktop.exe"

# Restart Docker Desktop
& "C:\Program Files\Docker\Docker\Docker Desktop.exe"

# Wait for startup, then retry commands
```

### Issue: Port Conflicts
**Cause**: Ports already in use
**Solution**:
```bash
# Find process using port
netstat -ano | findstr :1502

# Kill process (replace PID)
taskkill /PID <PID> /F
```

## 📋 **Development Workflow**

### 1. Schema Changes
```bash
# Edit api/prisma/schema.prisma
# Run migration
docker exec choreblimey-secure-api-1 npx prisma migrate dev --name <name>

# Update worker schema
docker cp choreblimey-secure-api-1:/app/api/prisma/schema.prisma ./temp-schema.prisma
docker cp ./temp-schema.prisma choreblimey-secure-worker-1:/app/worker/prisma/schema.prisma
docker exec choreblimey-secure-worker-1 npx prisma generate
docker restart choreblimey-secure-worker-1
rm ./temp-schema.prisma
```

### 2. Code Changes
```bash
# Rebuild affected services
docker compose -f docker/docker-compose-secure.yml build <service>
docker compose -f docker/docker-compose-secure.yml up <service> -d
```

### 3. Testing
```bash
# Check logs
docker logs choreblimey-secure-api-1 --tail 20
docker logs choreblimey-secure-worker-1 --tail 20

# Test API endpoints
curl http://localhost:1501/v1/health
curl http://localhost:1502/v1/health
```

## 🎯 **AI Development Notes**

### For AI Assistants:
1. **ALWAYS use `choreblimey-secure` stack** - never the legacy `choreblimey` stack
2. **Schema changes require worker updates** - copy schema from API to worker container
3. **Worker jobs are in `worker/src/jobs/`** - includes automated chore generation
4. **Database operations use API container** - worker has separate Prisma client
5. **Ports**: API(1501), Admin-API(1502), Web(1500), Admin-Web(1503), DB(1504), Redis(1505), MailHog(1506)

### Key Files:
- `docker/docker-compose-secure.yml` - Main compose file
- `docker/dev-secure.env` - Environment variables
- `api/prisma/schema.prisma` - Database schema
- `worker/src/jobs/choreGeneration.ts` - Automated chore generation
- `worker/src/utils/cache.ts` - Redis cache utilities

### Automated Jobs:
- **Daily Chore Generation**: 5:00 AM - Creates new chores, manages streaks, applies penalties
- **Nightly Reward Sync**: 3:00 AM - Syncs reward data
- **Birthday Bonus**: 6:00 AM - Awards birthday bonuses
- **Price Cache Refresh**: Every 6 hours
- **Account Cleanup**: Monthly on 1st at 2:00 AM

## 🚀 **Production Deployment**

For production deployment, ensure:
1. Update environment variables in `docker/dev-secure.env`
2. Use production database credentials
3. Set proper JWT secrets
4. Configure email service
5. Set up SSL certificates
6. Configure backup strategies

---

**Last Updated**: October 27, 2024
**Version**: 1.0.0
**Maintainer**: ChoreBlimey Development Team
