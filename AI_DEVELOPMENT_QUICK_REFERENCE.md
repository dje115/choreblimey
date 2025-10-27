# 🤖 AI Development Quick Reference

## 🚨 **CRITICAL REMINDERS FOR AI ASSISTANTS**

### 1. **ALWAYS Use Secure Stack**
```bash
# ✅ CORRECT - Use secure stack
docker compose -f docker/docker-compose-secure.yml --env-file docker/dev-secure.env up --build -d

# ❌ WRONG - Legacy stack is deprecated
docker compose -f docker/docker-compose.yml --env-file docker/dev.env up --build
```

### 2. **Schema Changes Require Worker Updates**
When modifying `api/prisma/schema.prisma`:
```bash
# 1. Run migration in API container
docker exec choreblimey-secure-api-1 npx prisma migrate dev --name <name>

# 2. Copy schema to worker container
docker cp choreblimey-secure-api-1:/app/api/prisma/schema.prisma ./temp-schema.prisma
docker cp ./temp-schema.prisma choreblimey-secure-worker-1:/app/worker/prisma/schema.prisma

# 3. Regenerate Prisma client in worker
docker exec choreblimey-secure-worker-1 npx prisma generate

# 4. Restart worker
docker restart choreblimey-secure-worker-1

# 5. Clean up
rm ./temp-schema.prisma
```

### 3. **Container Names**
- `choreblimey-secure-api-1` - Main API
- `choreblimey-secure-worker-1` - Background jobs
- `choreblimey-secure-web-1` - User web app
- `choreblimey-secure-admin-api-1` - Admin API
- `choreblimey-secure-admin-web-1` - Admin portal

### 4. **Ports**
- **1500**: User Web App
- **1501**: Main API
- **1502**: Admin API
- **1503**: Admin Portal
- **1504**: PostgreSQL
- **1505**: Redis
- **1506**: MailHog

### 5. **Common Commands**
```bash
# Check container status
docker ps | grep choreblimey-secure

# View logs
docker logs choreblimey-secure-api-1 --tail 20
docker logs choreblimey-secure-worker-1 --tail 20

# Database operations
docker exec choreblimey-secure-api-1 npx prisma migrate dev --name <name>
docker exec choreblimey-secure-api-1 npm run seed

# Test chore generation
docker exec choreblimey-secure-worker-1 node -e "
const { Queue } = require('bullmq');
const queue = new Queue('chore-generation', { connection: { host: 'redis', port: 6379 } });
queue.add('manual-test', {}, { priority: 1 }).then(job => console.log('Job added:', job.id));
"
```

### 6. **Key Files**
- `docker/docker-compose-secure.yml` - Main compose file
- `docker/dev-secure.env` - Environment variables
- `api/prisma/schema.prisma` - Database schema
- `worker/src/jobs/choreGeneration.ts` - Automated chore generation
- `worker/src/utils/cache.ts` - Redis cache utilities
- `DOCKER_DEVELOPMENT.md` - Comprehensive Docker guide

### 7. **Automated Jobs**
- **Daily Chore Generation**: 5:00 AM - Creates chores, manages streaks, applies penalties
- **Nightly Reward Sync**: 3:00 AM - Syncs reward data
- **Birthday Bonus**: 6:00 AM - Awards birthday bonuses
- **Price Cache Refresh**: Every 6 hours
- **Account Cleanup**: Monthly on 1st at 2:00 AM

### 8. **Troubleshooting**
- **"Unknown argument `paused`"**: Worker schema out of sync - follow schema update procedure
- **Migration drift**: Run `prisma migrate reset --force` (DESTROYS DATA)
- **Docker connection errors**: Restart Docker Desktop
- **Port conflicts**: Use `netstat -ano | findstr :PORT` to find and kill processes

### 9. **Development Workflow**
1. Make code changes
2. Rebuild affected containers: `docker compose -f docker/docker-compose-secure.yml build <service>`
3. Restart services: `docker compose -f docker/docker-compose-secure.yml up <service> -d`
4. Check logs for errors
5. Test functionality

### 10. **Testing**
- **API Health**: `curl http://localhost:1501/v1/health`
- **Admin API Health**: `curl http://localhost:1502/v1/health`
- **Manual Job Trigger**: Use the chore generation test command above

---

**Remember**: The `choreblimey-secure` stack is the ONLY active development environment. The legacy `choreblimey` stack is deprecated and should never be used.
