# ChoreBlimey! Development Guide

**For AI Assistants & Developers Continuing This Project**

Last Updated: October 21, 2025 | Version: 1.5.0

---

## 🎯 Quick Context

**What is ChoreBlimey?**  
A gamified family chore management app where children earn stars for completing tasks and parents manage pocket money. Think of it as "Duolingo meets chores" with sibling rivalry mechanics.

**Current Status**: Production-ready for 500 families (2,000 users) with Redis caching and smart performance optimizations.

---

## 📂 Key Documentation Files

| File | Purpose | Read This When... |
|------|---------|-------------------|
| **[README.md](README.md)** | Project overview & quick start | Setting up for the first time |
| **[TECHNICAL_SPEC.md](TECHNICAL_SPEC.md)** | Full system architecture | Understanding how everything works |
| **[PERFORMANCE.md](PERFORMANCE.md)** | Redis caching & scaling | Optimizing or debugging performance |
| **[CONTRIBUTING.md](CONTRIBUTING.md)** | Development workflow | Making changes to the codebase |
| **[SPEC.md](SPEC.md)** | Original product specification | Understanding requirements |

---

## 🏗️ Architecture At a Glance

```
Frontend (React + Vite)  →  API (Fastify)  →  PostgreSQL + Redis
                              ↓
                           Worker (BullMQ)
```

**6 Docker Containers**:
1. `web` - React frontend (Port 1500)
2. `api` - Fastify API (Port 1501)
3. `worker` - Background jobs
4. `postgres` - Database (Port 1502)
5. `redis` - Cache/Queue (Port 1507)
6. `mailhog` - Email testing (Port 1506)

---

## 🚀 Getting Started (5 Minutes)

```bash
# 1. Start all services
docker compose -f docker/docker-compose.yml up --build

# 2. Initialize database
docker compose -f docker/docker-compose.yml exec api npx prisma db push

# 3. Open app
# http://localhost:1500 (Frontend)
# http://localhost:1501/v1/health (API)
# http://localhost:1506 (MailHog)

# 4. Sign up as parent, check MailHog for magic link
```

**First-time test flow**:
1. Sign up as parent → Get magic link from MailHog
2. Invite 2 children (get join codes)
3. Log in as children using codes
4. Create 2-3 chores, assign to children
5. Children complete chores → Parents approve
6. Check leaderboard, payouts, transaction history

---

## 🔑 Critical Concepts

### 1. Multi-Tenancy (MOST IMPORTANT!)

**Every query MUST filter by `familyId`**

```typescript
// ✅ CORRECT
const chores = await prisma.chore.findMany({
  where: { familyId: req.claims.familyId }
})

// ❌ WRONG - Exposes all families' data!
const chores = await prisma.chore.findMany()
```

**Why?** Prevents Family A from seeing Family B's data. This is NON-NEGOTIABLE for data privacy.

### 2. Caching Strategy

**Redis caches these endpoints:**
- Leaderboards (5 min TTL) - Most expensive
- Family data (1 min TTL) - High frequency
- Wallet balances (30 sec TTL) - Moderate updates

**When to invalidate cache:**
- Child joins → `cache.invalidateFamily(familyId)`
- Chore completed → `cache.invalidateFamily(familyId)`
- Completion approved → `cache.invalidateWallet(childId)` + `cache.invalidateLeaderboard(familyId)`
- Wallet updated → `cache.invalidateWallet(childId)`

### 3. Stars Currency

**1 star = 10 pence (£0.10)**

```typescript
const stars = Math.floor(pence / 10)
const pence = stars * 10
```

Always store money as **pence** (integer) in the database, never as pounds (float).

### 4. Challenge Mode (Sibling Rivalry)

**Logic**: Children bid LOWER on chores. Lowest bidder wins and gets 2x stars (but only their bid amount in money).

```typescript
// If base reward is £0.10 (10 pence = 1 star):
// Child bids £0.05 (5 pence)
// On approval:
// - Wallet credited: 5 pence
// - Stars awarded: 1 star (displayed as "2⭐ Double Stars!")
// - Transaction metaJson: { rivalryBonus: true, doubledStars: true }
```

### 5. Authentication Flows

**Parent**: Email → Magic link (15 min) → JWT (7 days)  
**Child**: Join code → JWT (7 days, includes childId + familyId)

JWT structure:
```typescript
{
  sub: "user-id",
  role: "parent_admin" | "child_player",
  familyId: "family-uuid",
  childId?: "child-uuid", // Only for children
  exp: 1234567890
}
```

---

## 📁 Code Organization

### Backend (`api/`)

```
api/src/
├── controllers/         # Business logic for each resource
│   ├── auth.ts         # Signup, login, child join
│   ├── family.ts       # Family CRUD, invites
│   ├── children.ts     # Child management
│   ├── chores.ts       # Chore CRUD
│   ├── assignments.ts  # Assign chores to children
│   ├── completions.ts  # Submit, approve, reject
│   ├── wallet.ts       # Balance, credit, debit, transactions
│   ├── payouts.ts      # Record physical money transfers
│   ├── bids.ts         # Challenge Mode bidding
│   ├── streaks.ts      # Streak calculation
│   ├── leaderboard.ts  # Weekly rankings
│   └── rewards.ts      # Redemptions
├── routes/
│   └── index.ts        # Route definitions (calls controllers)
├── utils/
│   ├── auth.ts         # JWT middleware
│   ├── cache.ts        # Redis cache utility
│   ├── crypto.ts       # Token/code generation
│   ├── email.ts        # Magic links, join codes
│   └── streaks.ts      # Streak bonus calculation
├── db/
│   └── prisma.ts       # Prisma client singleton
└── server.ts           # Fastify app setup
```

### Frontend (`web/`)

```
web/src/
├── pages/
│   ├── LoginPage.tsx          # Child-friendly login screen
│   ├── ParentDashboard.tsx    # Parent view (manage chores, approve, payouts)
│   └── ChildDashboard.tsx     # Child view (complete chores, claim rewards)
├── components/
│   ├── Toast.tsx              # Notifications
│   ├── Confetti.tsx           # Celebration animations
│   └── ui/@cb-ui/             # Reusable UI components
├── contexts/
│   └── AuthContext.tsx        # Global auth state
├── lib/
│   └── api.ts                 # API client (all fetch calls)
├── themes/
│   └── childThemes.ts         # 7 theme definitions
└── main.tsx                   # Entry point
```

### Database (`api/prisma/`)

```
prisma/
├── schema.prisma      # Database models & relations
└── migrations/        # Auto-generated migration history
```

---

## 🛠️ Common Development Tasks

### Adding a New Feature

**Example**: Add a "Notes" field to chores

1. **Update Prisma Schema**:
```prisma
model Chore {
  id String @id @default(uuid())
  // ...existing fields...
  notes String? @db.Text  // NEW
}
```

2. **Generate Migration**:
```bash
docker compose -f docker/docker-compose.yml exec api npx prisma migrate dev --name add_chore_notes
```

3. **Update API Controller** (`api/src/controllers/chores.ts`):
```typescript
interface CreateChoreBody {
  // ...existing...
  notes?: string  // NEW
}

export const create = async (req, reply) => {
  const { notes } = req.body  // NEW
  
  const chore = await prisma.chore.create({
    data: {
      familyId,
      // ...existing...
      notes  // NEW
    }
  })
  
  // Don't forget cache invalidation!
  await cache.invalidateFamily(familyId)
  
  return { chore }
}
```

4. **Update Frontend** (`web/src/pages/ParentDashboard.tsx`):
```typescript
const [newChore, setNewChore] = useState({
  // ...existing...
  notes: ''  // NEW
})

// In JSX:
<textarea
  value={newChore.notes}
  onChange={(e) => setNewChore(prev => ({ ...prev, notes: e.target.value }))}
  placeholder="Additional notes..."
/>
```

5. **Test Flow**:
- Create chore with notes
- Verify notes appear in chore list
- Check database: `SELECT notes FROM "Chore" LIMIT 5;`

### Debugging Issues

**API not responding:**
```bash
docker logs choreblimey-api-1 --tail 50
# Look for errors, Redis connection, Prisma issues
```

**Stale data (cache issue):**
```bash
# Clear Redis cache
docker exec choreblimey-redis-1 redis-cli FLUSHALL

# Check if cache invalidation is missing in controller
grep -r "invalidateFamily\|invalidateWallet" api/src/controllers/
```

**Database out of sync:**
```bash
# Reset and push schema (DEV ONLY - WIPES DATA!)
docker compose -f docker/docker-compose.yml exec api npx prisma db push --force-reset
```

**Port conflicts:**
```bash
# Check what's using port 1500
netstat -ano | findstr :1500  # Windows
lsof -i :1500                 # Mac/Linux

# Kill process or change port in docker-compose.yml
```

### Performance Optimization Checklist

When adding new endpoints:
- [ ] Does this query filter by `familyId`?
- [ ] Is this query expensive? (joins, aggregations) → Add caching
- [ ] Does this modify data? → Invalidate related caches
- [ ] Does this need an index? → Add `@@index([field])` in schema
- [ ] Is input validated? → Add Fastify schema
- [ ] Are errors handled? → Wrap in try/catch

---

## 🎨 UI/UX Guidelines

### Design Principles

1. **Child-Friendly**: Large buttons, emoji icons, bright colors
2. **Mobile-First**: Works on 390px width screens
3. **Playful**: Rounded corners (1.25rem), gradients, animations
4. **Accessible**: High contrast text, clear labels

### Color Palette

```css
:root {
  --primary: #FF8A00;      /* Orange */
  --secondary: #2D9BF0;    /* Blue */
  --success: #00C897;      /* Green */
  --warning: #FEC93D;      /* Yellow */
  --background: #FFF8F0;   /* Cream */
  --text-primary: #333333;
  --text-secondary: #666666;
  --bonus-stars: #FFD700;  /* Gold */
}
```

### Typography

- **Headings**: Baloo 2 or Fredoka One (playful, rounded)
- **Body**: Poppins or Nunito (clean, readable)
- **Sizes**: 
  - Hero: 2.5rem (40px)
  - Heading: 1.5rem (24px)
  - Body: 1rem (16px)
  - Small: 0.875rem (14px)

### Components

Use Tailwind utility classes:
```tsx
<div className="cb-card">
  {/* Predefined: p-6, rounded-[1.25rem], shadow-md, bg-white */}
</div>

<button className="cb-button-primary">
  {/* Predefined: px-6, py-3, bg-gradient-to-r, rounded-lg, font-bold */}
</button>
```

### Responsive Breakpoints

```css
/* Mobile: default (≤640px) */
/* Tablet: sm: (≥640px) */
/* Desktop: md: (≥768px) */
/* Large: lg: (≥1024px) */
```

Example:
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* 1 column on mobile, 2 on tablet, 3 on desktop */}
</div>
```

---

## 🧪 Testing Strategy

### Manual Testing Checklist

**Parent Flow:**
- [ ] Sign up → Receive magic link → Log in
- [ ] Family auto-created with email prefix
- [ ] Invite child → Get join code
- [ ] Create chore → Assign to child
- [ ] Child completes chore → Approve/reject
- [ ] Process payout → Wallet debited
- [ ] View leaderboard, activity feed
- [ ] Update family settings (budget, name)

**Child Flow:**
- [ ] Use join code → Create account
- [ ] Select theme → See personalized greeting
- [ ] View "Today" chores → Complete one
- [ ] Bid on Challenge chore → Steal from sibling
- [ ] Complete Challenge → Get 2x stars
- [ ] View Bank tab → See transaction history
- [ ] Check Star Bank → See lifetime earnings (if enabled)

**Edge Cases:**
- [ ] Approve chore with no bids (should use base reward)
- [ ] Reject chore (wallet not credited)
- [ ] Sibling bids same amount (first to claim wins)
- [ ] Complete chore after being outbid (should fail with 403)
- [ ] Payout more than wallet balance (should fail)
- [ ] Invite child with existing email (should create new child, not merge)

### Unit Testing (TODO)

```typescript
// Example test structure (Jest/Vitest)
describe('Completions API', () => {
  it('should only allow champion to complete challenge chore', async () => {
    // Setup
    const family = await createFamily()
    const [childA, childB] = await createChildren(family.id, 2)
    const chore = await createChore(family.id, { biddingEnabled: true })
    const assignment = await createAssignment(chore.id, family.id)
    
    // Child A bids £0.10, Child B bids £0.05
    await createBid(assignment.id, childA.id, 10)
    await createBid(assignment.id, childB.id, 5)
    
    // Child A tries to complete (should fail)
    const response = await api.post('/v1/completions', {
      assignmentId: assignment.id
    }, { token: childA.token })
    
    expect(response.status).toBe(403)
    expect(response.body.error).toContain('Only the current champion')
  })
})
```

---

## 🔐 Security Checklist

**Before pushing to production:**

- [ ] Change `JWT_SECRET` in `.env` (min 32 characters)
- [ ] Use strong database password
- [ ] Enable HTTPS (use Let's Encrypt or Cloudflare)
- [ ] Set `NODE_ENV=production`
- [ ] Rate limiting enabled (500 req/min)
- [ ] Helmet security headers enabled
- [ ] CORS configured for specific domain
- [ ] Prisma client in production mode
- [ ] Redis ACL enabled (not default user)
- [ ] Database backups scheduled (daily)
- [ ] Secrets in environment variables (not code)
- [ ] Client-side encryption for child PII (TODO)

---

## 📊 Monitoring & Maintenance

### Health Checks

```bash
# API health
curl http://localhost:1501/v1/health
# Expected: {"status":"ok","timestamp":"2025-10-21T..."}

# Redis connection
docker logs choreblimey-api-1 | grep "Redis"
# Expected: "✅ Redis cache connected"

# Database size
docker compose -f docker/docker-compose.yml exec postgres psql -U choreblimey choreblimey -c "SELECT pg_size_pretty(pg_database_size('choreblimey'));"
```

### Performance Metrics

```bash
# Cache hit rate
docker exec choreblimey-redis-1 redis-cli INFO stats | grep "keyspace_hits\|keyspace_misses"

# Request rate
docker logs choreblimey-api-1 | grep "request completed" | tail -100

# Database connections
docker compose -f docker/docker-compose.yml exec postgres psql -U choreblimey choreblimey -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'choreblimey';"
```

### Backup & Restore

```bash
# Backup database
docker compose -f docker/docker-compose.yml exec -T postgres pg_dump -U choreblimey choreblimey > backup_$(date +%Y%m%d).sql

# Restore database
docker compose -f docker/docker-compose.yml exec -T postgres psql -U choreblimey choreblimey < backup_20251021.sql

# Backup Redis (if needed)
docker exec choreblimey-redis-1 redis-cli SAVE
docker cp choreblimey-redis-1:/data/dump.rdb ./redis_backup.rdb
```

---

## 🚧 Known Issues & TODOs

### High Priority
- [ ] Client-side encryption for child PII (`realNameCipher`, `dobCipher`)
- [ ] Photo proof uploads (S3 integration)
- [ ] Email rate limiting (prevent spam)
- [ ] Soft delete for chores (instead of hard delete)

### Medium Priority
- [ ] Unit tests (Jest/Vitest)
- [ ] E2E tests (Playwright)
- [ ] API documentation (Swagger/OpenAPI)
- [ ] Logging framework (Winston/Pino)
- [ ] Monitoring (Prometheus metrics)

### Low Priority
- [ ] Dark mode toggle
- [ ] i18n (multi-language support)
- [ ] Mobile apps (React Native)
- [ ] Social features (friend leaderboards)

---

## 🤖 For AI Assistants

**When asked to add a feature:**

1. **Understand the request** - Ask clarifying questions
2. **Check multi-tenancy** - Will this query filter by `familyId`?
3. **Plan cache strategy** - Is this data cached? When to invalidate?
4. **Update schema** - Does this need a new model or field?
5. **Backend first** - API endpoint → Controller → Route
6. **Frontend second** - Update API client → UI component
7. **Test manually** - Parent + child flows
8. **Document changes** - Update relevant `.md` files
9. **Commit with convention** - `feat(scope): description`

**When debugging:**

1. **Check logs** - `docker logs choreblimey-api-1`
2. **Verify cache** - Clear Redis if stale data
3. **Database state** - Use Prisma Studio to inspect
4. **Network requests** - Browser DevTools → Network tab
5. **JWT claims** - Decode token at jwt.io
6. **Multi-tenancy** - Verify `familyId` in queries

**When optimizing:**

1. **Profile first** - Where is the bottleneck?
2. **Add caching** - Use Redis for expensive queries
3. **Invalidate smartly** - Clear only affected caches
4. **Add indexes** - `@@index([field])` in Prisma schema
5. **Horizontal scale** - Multiple API instances + load balancer

---

## 📞 Getting Help

**Stuck? Check these in order:**

1. **README.md** - Quick start guide
2. **TECHNICAL_SPEC.md** - Full architecture details
3. **Logs** - `docker logs choreblimey-api-1 --tail 100`
4. **Database** - `npx prisma studio` to inspect data
5. **Cache** - `docker exec choreblimey-redis-1 redis-cli MONITOR`
6. **Git history** - `git log --oneline` to see recent changes
7. **This guide** - You're reading it!

**Common error messages:**

| Error | Cause | Solution |
|-------|-------|----------|
| `The table 'X' does not exist` | Prisma schema out of sync | Run `npx prisma db push` |
| `Redis connection error` | Redis not running | Check `docker ps` |
| `JWT expired` | Token older than 7 days | Log in again |
| `Family not found` | User not in a family | Auto-creates on first invite |
| `Only the current champion can complete` | Outbid in Challenge Mode | Place lower bid first |

---

## 🎓 Learning Resources

**Technologies Used:**
- **Fastify**: https://fastify.dev
- **Prisma**: https://www.prisma.io/docs
- **React**: https://react.dev
- **Tailwind**: https://tailwindcss.com
- **Docker**: https://docs.docker.com/compose
- **Redis**: https://redis.io/docs

**Concepts to Understand:**
- Multi-tenancy in SaaS
- JWT authentication
- Cache-aside pattern
- Event-driven architecture
- Microservices communication

---

## 🎉 You're Ready!

You now have everything needed to continue development:

✅ Full system architecture  
✅ Code organization  
✅ Development workflow  
✅ Testing strategy  
✅ Performance optimization  
✅ Security guidelines  
✅ Troubleshooting guide  

**Go build something awesome!** 🚀

---

**Last Updated**: October 21, 2025  
**Version**: 1.5.0  
**Maintainer**: ChoreBlimey! Development Team

**Turn chores into cheers!** 🌟

