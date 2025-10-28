# ⚠️ CRITICAL: ALWAYS USE THE SECURE STACK ⚠️

## 🚨 THIS PROJECT USES THE SECURE DOCKER COMPOSE FILE 🚨

**NEVER** use `docker/docker-compose.yml`  
**ALWAYS** use `docker/docker-compose-secure.yml`

---

## ✅ CORRECT Commands:

```bash
# Start the stack
docker compose -f docker/docker-compose-secure.yml up -d

# Stop the stack
docker compose -f docker/docker-compose-secure.yml down

# Rebuild a service
docker compose -f docker/docker-compose-secure.yml build <service>

# View logs
docker compose -f docker/docker-compose-secure.yml logs -f <service>

# Restart a service
docker compose -f docker/docker-compose-secure.yml restart <service>

# Execute commands in a container
docker compose -f docker/docker-compose-secure.yml exec <service> <command>
```

---

## ❌ WRONG Commands (NEVER USE THESE):

```bash
# ❌ WRONG - Non-secure stack
docker compose -f docker/docker-compose.yml up -d

# ❌ WRONG - Non-secure stack
docker compose -f docker/docker-compose.yml down
```

---

## 🔍 How to Verify Which Stack is Running:

```bash
# List all running containers
docker ps

# You should see containers prefixed with "choreblimey-secure-"
# NOT "choreblimey-" without the "-secure" suffix
```

### Expected Container Names (SECURE STACK):
- `choreblimey-secure-web-1`
- `choreblimey-secure-api-1`
- `choreblimey-secure-worker-1`
- `choreblimey-secure-admin-api-1`
- `choreblimey-secure-admin-web-1`
- `choreblimey-secure-postgres-1`
- `choreblimey-secure-redis-1`
- `choreblimey-secure-mailhog-1`

### ⚠️ WARNING: If you see these (NON-SECURE STACK):
- `choreblimey-web-1` (without "secure")
- `choreblimey-api-1` (without "secure")
- **STOP IMMEDIATELY** and clean up!

---

## 🧹 Clean Up Non-Secure Stack (If Accidentally Started):

```bash
# Remove non-secure stack containers
docker compose -f docker/docker-compose.yml down

# Verify they're gone
docker ps -a | grep choreblimey

# You should ONLY see "choreblimey-secure-" prefixed containers
```

---

## 🔗 Quick Reference:

| Task | Secure Stack Command |
|------|---------------------|
| Start | `docker compose -f docker/docker-compose-secure.yml up -d` |
| Stop | `docker compose -f docker/docker-compose-secure.yml down` |
| Logs | `docker compose -f docker/docker-compose-secure.yml logs -f` |
| Rebuild | `docker compose -f docker/docker-compose-secure.yml build` |
| Restart | `docker compose -f docker/docker-compose-secure.yml restart` |

---

## 📍 Port Mapping (SECURE STACK):

| Service | Port | URL |
|---------|------|-----|
| Web (Parent/Child) | 1500 | http://localhost:1500 |
| API | 1501 | http://localhost:1501 |
| Admin API | 1502 | http://localhost:1502 |
| Admin Web | 1503 | http://localhost:1503 |
| PostgreSQL | 1504 | localhost:1504 |
| Redis | 1505 | localhost:1505 |
| MailHog UI | 1506 | http://localhost:1506 |
| MailHog SMTP | 2526 | localhost:2526 |

---

## ⚠️ Port Conflicts:

The non-secure stack uses **different ports** that can conflict:
- Non-secure postgres: `1502:5432` (conflicts with Admin API at 1502)
- Non-secure redis: `1507:6379` (different from secure)
- Non-secure MailHog: `2525:1025` (different from secure)

**This is why we ALWAYS use the secure stack!**

---

## 🤖 AI Assistant Checklist:

Before running ANY docker compose command:

- [ ] Is the file path `docker/docker-compose-secure.yml`?
- [ ] Does the command include `-secure` in the filename?
- [ ] Are you building/starting services from the secure stack?
- [ ] Have you checked `docker ps` to verify the correct stack?

**If you answer "NO" to any of these, STOP and fix the command!**

---

## 📝 Why We Use the Secure Stack:

1. ✅ **Isolated Admin Portal**: Separate admin-api and admin-web containers
2. ✅ **Network Segmentation**: Dedicated networks (admin_net, user_net, db_net)
3. ✅ **Security**: Admin services isolated from user services
4. ✅ **Monitoring**: Real-time system health and performance metrics
5. ✅ **Audit Trail**: Complete logging of all admin actions

**The non-secure stack is deprecated and should NOT be used!**

---

**Last Updated**: October 28, 2025  
**Author**: ChoreBlimey Team  
**Priority**: 🚨 CRITICAL 🚨

