# ChoreBlimey! Technical Specification v1.5
**Last Updated**: October 21, 2025  
**Status**: Production-Ready for 500 Families

---

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Technology Stack](#technology-stack)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [Authentication & Authorization](#authentication--authorization)
6. [Caching Strategy](#caching-strategy)
7. [Multi-Tenancy](#multi-tenancy)
8. [Gamification Logic](#gamification-logic)
9. [Performance & Scaling](#performance--scaling)
10. [Security Considerations](#security-considerations)
11. [Deployment](#deployment)
12. [Development Workflow](#development-workflow)

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT (Browser)                        │
│                 React 18 + Vite 7 + Tailwind               │
└─────────────────┬───────────────────────────────────────────┘
                  │ HTTP/HTTPS
                  │ JWT Tokens
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    NGINX (Future)                           │
│              Load Balancer / Reverse Proxy                  │
└─────────────────┬───────────────────────────────────────────┘
                  │
       ┌──────────┴──────────┬──────────────┐
       │                     │              │
       ▼                     ▼              ▼
┌──────────────┐      ┌──────────────┐    ...
│  API Instance│      │  API Instance│    (Horizontal Scaling)
│  (Fastify 4) │      │  (Fastify 4) │
└──────┬───────┘      └──────┬───────┘
       │                     │
       └──────────┬──────────┘
                  │
       ┌──────────┼──────────┬──────────────┐
       │          │          │              │
       ▼          ▼          ▼              ▼
┌──────────┐ ┌────────┐ ┌────────┐  ┌──────────┐
│PostgreSQL│ │ Redis  │ │ Worker │  │ MailHog  │
│    17    │ │  7.4   │ │(BullMQ)│  │ (Dev)    │
│ (Primary)│ │(Cache/ │ │        │  │          │
│          │ │ Queue) │ │        │  │          │
└──────────┘ └────────┘ └────────┘  └──────────┘
```

### Microservices Architecture

| Service | Technology | Purpose | Scaling Strategy |
|---------|-----------|---------|------------------|
| **Web** | React 18 + Vite 7 | Frontend UI | CDN (Cloudflare) |
| **API** | Fastify 4 + Prisma 6 | REST API | Horizontal (3-5 instances) |
| **Worker** | BullMQ + TypeScript | Background jobs | Vertical (CPU-bound) |
| **PostgreSQL** | v17 Alpine | Primary database | Read replicas |
| **Redis** | v7.4 Alpine | Cache + Queue | Redis Cluster |
| **MailHog** | v1.0.1 | Email testing (dev) | Replaced by SendGrid (prod) |

---

## Technology Stack

### Backend

**Framework**: Fastify 4.28.1
- Chosen for: Speed (2x faster than Express), TypeScript support, validation
- Plugins: CORS, Helmet, Rate Limiting, Multipart

**ORM**: Prisma 6.17.1
- Chosen for: Type safety, migrations, auto-complete
- Database: PostgreSQL 17 (latest stable)
- Connection pooling: Enabled (max 10 connections per instance)

**Authentication**: JWT (jsonwebtoken 9.0.2)
- Token expiry: 7 days
- Magic links expiry: 15 minutes
- Join codes expiry: 7 days

**Caching**: Redis 7.4 (ioredis 5.4.1)
- Use case: Query caching, session storage, BullMQ queue
- Strategy: Cache-aside with smart invalidation

**Email**: Nodemailer 6.9.15
- Dev: MailHog (SMTP on port 2525)
- Prod: SendGrid API (recommended)

### Frontend

**Framework**: React 18.3.1
- Build tool: Vite 7.0.2 (fast HMR, ESM-native)
- Routing: React Router 7.1.3
- State: React Context API + useState/useEffect

**Styling**: Tailwind CSS 3.4.17
- Custom theme system (7 child themes)
- CSS variables for dynamic theming
- Responsive: Mobile-first design

**Icons & Assets**: Emoji-based (no external icon library)
- Keeps bundle size small
- Universal browser support

### DevOps

**Containerization**: Docker 27.x + Docker Compose
- Multi-stage builds for optimized images
- Non-root users for security
- Volume mounts for hot-reload in dev

**Version Control**: Git + GitHub
- Branch strategy: main (production-ready)
- Commit convention: Conventional Commits

---

## Database Schema

### Entity Relationship Diagram

```
┌──────────┐         ┌──────────────┐         ┌──────────┐
│   User   │────────▶│ FamilyMember │◀────────│  Family  │
└──────────┘  1:N    └──────────────┘  N:1    └────┬─────┘
                                                    │1
                                                    │
                     ┌──────────────────────────────┼────────────┐
                     │                              │            │
                     ▼N                             ▼N           ▼N
              ┌────────────┐                  ┌─────────┐   ┌────────┐
              │   Child    │                  │  Chore  │   │Rewards │
              └─────┬──────┘                  └────┬────┘   └────────┘
                    │1                             │1
                    │                              │
                    ├──────────┬───────────────────┤
                    │          │                   │
                    ▼N         ▼N                  ▼N
              ┌──────────┐ ┌──────────────┐ ┌────────────┐
              │  Wallet  │ │  Assignment  │ │  Streaks   │
              └─────┬────┘ └──────┬───────┘ └────────────┘
                    │1             │1
                    │              │
                    ▼N             ▼N
             ┌──────────────┐ ┌────────────┐
             │ Transaction  │ │ Completion │
             └──────────────┘ └─────┬──────┘
                                    │1
                                    ▼N
                              ┌──────────┐
                              │   Bid    │
                              └──────────┘
```

### Core Models

#### User
- **Purpose**: Parent/relative accounts
- **Auth**: Email + JWT (passwordless)
- **Fields**: id, email, createdAt

#### Family
- **Purpose**: Container for all family data
- **Multi-tenant**: All queries scoped by familyId
- **Fields**: id, nameCipher, maxBudgetPence, budgetPeriod, budgetStartDate, showLifetimeEarnings, createdAt

#### FamilyMember
- **Purpose**: Links users to families with roles
- **Roles**: parent_admin, parent_viewer, relative_contributor
- **Fields**: id, familyId, userId, role, createdAt

#### Child
- **Purpose**: Kids in the family
- **Auth**: Join code → JWT
- **Fields**: id, familyId, nickname, realNameCipher, dobCipher, ageGroup, gender, theme, createdAt
- **Encryption**: realNameCipher and dobCipher use client-side encryption (TODO)

#### Chore
- **Purpose**: Task templates
- **Fields**: id, familyId, title, description, frequency, baseRewardPence, proofType, createdAt

#### Assignment
- **Purpose**: Assigns chores to children
- **Fields**: id, familyId, choreId, childId, biddingEnabled, createdAt
- **Note**: childId=null means available to all

#### Completion
- **Purpose**: Records chore completions
- **Status**: pending → approved/rejected
- **Fields**: id, familyId, childId, assignmentId, status, proofUrl, note, bidAmountPence, timestamp

#### Wallet
- **Purpose**: Child's virtual wallet
- **Currency**: Pence (1 star = 10 pence)
- **Fields**: id, familyId, childId, balancePence

#### Transaction
- **Purpose**: Audit log for wallet changes
- **Types**: credit (earned), debit (spent/paid out)
- **Fields**: id, walletId, familyId, type, amountPence, source, metaJson, createdAt

#### Payout
- **Purpose**: Records physical money transfers
- **Methods**: cash, bank_transfer, other
- **Fields**: id, familyId, childId, amountPence, paidBy, method, note, createdAt

#### Streak
- **Purpose**: Tracks consecutive completions
- **Scope**: Per child, per chore, and overall
- **Fields**: id, familyId, childId, choreId, current, longest, lastCompletedAt

#### Bid
- **Purpose**: Challenge Mode - bidding on chores
- **Logic**: Lowest bid wins, gets 2x stars
- **Fields**: id, familyId, childId, assignmentId, amountPence, createdAt

#### Reward
- **Purpose**: Redemption goals for children
- **Fields**: id, familyId, title, description, costPence, imageUrl, affiliateUrl, category, daysOutUrl, genderTag

#### Redemption
- **Purpose**: Child claims a reward
- **Status**: pending → fulfilled
- **Fields**: id, familyId, childId, rewardId, costPaid, status, createdAt

---

## API Endpoints

See [API.md](API.md) for complete endpoint documentation with request/response examples.

### Authentication Endpoints

```
POST   /v1/auth/signup-parent     # Magic link signup
POST   /v1/auth/callback          # Magic link verification
POST   /v1/auth/child-join        # Child joins via code
POST   /v1/auth/generate-join-code # Generate new join code
```

### Family Endpoints

```
POST   /v1/family                 # Create family
GET    /v1/family                 # Get family details
PATCH  /v1/family                 # Update family settings
GET    /v1/family/members         # List all members & children
POST   /v1/family/invite          # Invite child/relative
GET    /v1/family/budget          # Get budget breakdown
GET    /v1/family/join-codes      # List active join codes
```

### Children Endpoints

```
POST   /v1/children               # Create child
PATCH  /v1/children/:id           # Update child (nickname, theme, etc.)
```

### Chores Endpoints

```
POST   /v1/chores                 # Create chore
GET    /v1/chores                 # List all chores
PATCH  /v1/chores/:id             # Update chore
DELETE /v1/chores/:id             # Delete chore (soft delete)
```

### Assignments Endpoints

```
POST   /v1/assignments            # Assign chore to child
GET    /v1/assignments            # List assignments (filtered by child)
```

### Completions Endpoints

```
POST   /v1/completions            # Child submits completion
GET    /v1/completions            # List completions (filter by status)
POST   /v1/completions/:id/approve  # Parent approves
POST   /v1/completions/:id/reject   # Parent rejects
```

### Wallet Endpoints

```
GET    /v1/wallet/:childId        # Get balance
POST   /v1/wallet/:childId/credit # Manual credit (parent)
POST   /v1/wallet/:childId/debit  # Manual debit (parent)
GET    /v1/wallet/:childId/transactions  # Transaction history
GET    /v1/wallet/:childId/stats  # Lifetime earnings
```

### Payout Endpoints

```
POST   /v1/payouts                # Record payout
GET    /v1/payouts                # List payouts (filter by child)
GET    /v1/payouts/unpaid/:childId  # Get unpaid balance
```

### Leaderboard Endpoints

```
GET    /v1/leaderboard            # Weekly leaderboard
```

### Bids Endpoints (Challenge Mode)

```
POST   /v1/bids                   # Place a bid
GET    /v1/bids                   # List bids for assignment
```

### Streaks Endpoints

```
GET    /v1/streaks/:childId       # Get streak stats
```

### Rewards Endpoints

```
GET    /v1/rewards                # List available rewards
POST   /v1/redemptions            # Claim a reward
GET    /v1/redemptions            # List redemptions (filter by status)
POST   /v1/redemptions/:id/fulfill  # Parent fulfills reward
```

---

## Authentication & Authorization

### JWT Token Structure

```typescript
interface JWTPayload {
  sub: string              // User ID or Child ID
  role: 'parent_admin' | 'parent_viewer' | 'relative_contributor' | 'child_player'
  familyId: string         // Family ID (for multi-tenancy)
  childId?: string         // Present if role=child_player
  nickname?: string        // Child's nickname
  ageGroup?: string        // Child's age group
  exp: number              // Unix timestamp (7 days)
}
```

### Role-Based Access Control (RBAC)

| Role | Can Do |
|------|--------|
| **parent_admin** | Full control: create/edit chores, approve/reject, manage budget, view reports |
| **parent_viewer** | Read-only: view chores, completions, leaderboards |
| **relative_contributor** | Create chores, approve completions (no budget/settings access) |
| **child_player** | Submit completions, bid on chores, claim rewards, view own data |

### Authentication Flow

#### Parent Signup/Login
1. User enters email → `POST /v1/auth/signup-parent`
2. API generates token, stores in AuthToken table (15 min expiry)
3. Email sent with magic link: `http://localhost:1500/auth/callback?token={token}`
4. User clicks link → Frontend calls `POST /v1/auth/callback`
5. API validates token, generates JWT (7 days)
6. Frontend stores JWT in localStorage, redirects to ParentDashboard

#### Child Join
1. Parent generates join code → `POST /v1/family/invite`
2. Join code stored in ChildJoinCode table (7 days expiry)
3. Child enters code → `POST /v1/auth/child-join`
4. API validates code, creates Child record, generates JWT
5. Frontend stores JWT, redirects to ChildDashboard

### Security Middleware

```typescript
// api/src/utils/auth.ts
export const requireAuth = (requiredRole?: string) => {
  return async (req, reply) => {
    // Extract JWT from Authorization header
    const token = req.headers.authorization?.split(' ')[1]
    
    // Verify and decode
    const claims = jwt.verify(token, JWT_SECRET)
    
    // Check role if specified
    if (requiredRole && claims.role !== requiredRole) {
      return reply.status(403).send({ error: 'Insufficient permissions' })
    }
    
    // Attach to request
    req.claims = claims
  }
}
```

---

## Caching Strategy

### Redis Cache Architecture

**Goal**: Reduce database load by 80-90%, improve response times by 4-5x

**Implementation**: Cache-aside pattern with smart invalidation

### Cache Keys

```typescript
// api/src/utils/cache.ts
export const cacheKeys = {
  family: (familyId: string) => `family:${familyId}`,
  familyMembers: (familyId: string) => `family:${familyId}:members`,
  children: (familyId: string) => `children:${familyId}`,
  wallet: (childId: string) => `wallet:${childId}`,
  walletStats: (childId: string) => `wallet:${childId}:stats`,
  leaderboard: (familyId: string) => `leaderboard:${familyId}`,
  streaks: (childId: string) => `streaks:${childId}`,
  chores: (familyId: string) => `chores:${familyId}`,
  assignments: (childId: string) => `assignments:${childId}`
}
```

### Cache TTLs

| Data Type | TTL | Reason |
|-----------|-----|--------|
| **Leaderboard** | 5 minutes | Expensive query, updates weekly |
| **Family Data** | 1 minute | Moderate updates, high read frequency |
| **Family Members** | 2 minutes | Rarely changes |
| **Wallet Balance** | 30 seconds | Frequently updated |
| **Wallet Stats** | 5 minutes | Lifetime stats change slowly |
| **Streaks** | 1 minute | Daily updates |
| **Chores/Assignments** | 2 minutes | Moderate churn |

### Cache Invalidation Events

```typescript
// When these happen, clear related caches:

// Child joins/created → invalidateFamily(familyId)
// Child updated → invalidateFamily(familyId)
// Chore completed → invalidateFamily(familyId)
// Completion approved → invalidateWallet(childId) + invalidateLeaderboard(familyId)
// Completion rejected → invalidateFamily(familyId)
// Wallet credit/debit → invalidateWallet(childId)
// Family updated → invalidateFamily(familyId)
```

### Cache Utility Methods

```typescript
class Cache {
  // Get from cache
  async get<T>(key: string): Promise<T | null>
  
  // Set with TTL
  async set(key: string, value: any, ttl: number): Promise<void>
  
  // Delete single key
  async del(key: string): Promise<void>
  
  // Delete by pattern (e.g., "family:abc-123:*")
  async delPattern(pattern: string): Promise<void>
  
  // Get-or-set pattern
  async getOrSet<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T>
  
  // Invalidate all family caches
  async invalidateFamily(familyId: string): Promise<void>
  
  // Invalidate wallet caches
  async invalidateWallet(childId: string): Promise<void>
  
  // Invalidate leaderboard
  async invalidateLeaderboard(familyId: string): Promise<void>
}
```

---

## Multi-Tenancy

### Strict Isolation

**Rule**: Every database query MUST filter by `familyId` to prevent cross-family data leaks.

```typescript
// ✅ CORRECT
const chores = await prisma.chore.findMany({
  where: { familyId: req.claims.familyId }
})

// ❌ WRONG - exposes all families' data
const chores = await prisma.chore.findMany()
```

### JWT-Based Scoping

All API endpoints extract `familyId` from the JWT:

```typescript
export const getChores = async (req, reply) => {
  const { familyId } = req.claims! // From JWT
  
  const chores = await prisma.chore.findMany({
    where: { familyId } // Always scope
  })
  
  return { chores }
}
```

### Database Indexes

All frequently-queried tables have composite indexes on `familyId`:

```prisma
model Chore {
  // ...
  @@index([familyId])
  @@index([familyId, createdAt])
}

model Completion {
  // ...
  @@index([familyId, status])
  @@index([familyId, childId, timestamp])
}
```

### Testing Multi-Tenancy

```typescript
// Test: Ensure family A cannot access family B's data
test('chores endpoint respects familyId', async () => {
  const familyA = await createFamily('Family A')
  const familyB = await createFamily('Family B')
  
  const choreA = await createChore(familyA.id, 'Chore A')
  const choreB = await createChore(familyB.id, 'Chore B')
  
  // Authenticate as family A
  const tokenA = generateJWT({ familyId: familyA.id })
  
  // Request should only return family A's chores
  const response = await api.get('/v1/chores', {
    headers: { Authorization: `Bearer ${tokenA}` }
  })
  
  expect(response.body.chores).toHaveLength(1)
  expect(response.body.chores[0].id).toBe(choreA.id)
})
```

---

## Gamification Logic

### Stars System

**Conversion**: 1 star = 10 pence (£0.10)

```typescript
const stars = Math.floor(pence / 10)
const pence = stars * 10
```

### Chore Completion Flow

1. Child marks chore as done → `POST /v1/completions`
2. Completion status = `pending`
3. Parent reviews → `POST /v1/completions/:id/approve` or `/reject`
4. If approved:
   - Credit wallet with `baseRewardPence` (or `bidAmountPence` for challenges)
   - Update streak (check for bonuses)
   - Invalidate caches
   - Create transaction record

### Streak Bonuses

**Logic**: Award bonus stars for consecutive completions

```typescript
// api/src/utils/streaks.ts
export const calculateStreakBonusStars = (streakLength: number): number => {
  if (streakLength >= 30) return 5  // 1 month: 5 stars
  if (streakLength >= 14) return 3  // 2 weeks: 3 stars
  if (streakLength >= 7) return 2   // 1 week: 2 stars
  if (streakLength >= 3) return 1   // 3 days: 1 star
  return 0
}
```

**Streak Types**:
- **Chore-specific**: Consecutive days completing a specific chore
- **Overall**: Consecutive days completing any chore

### Challenge Mode (Sibling Rivalry)

**Concept**: Children bid LOWER to "steal" chores. Winner gets 2x stars (but only the bid amount in money).

**Flow**:
1. Parent creates chore with `biddingEnabled: true`
2. Children place bids: `POST /v1/bids { amountPence: 5 }` (must be ≤ baseReward)
3. Current champion = lowest bidder
4. Only champion can complete the chore: `POST /v1/completions`
5. On approval:
   - Wallet credited with `bidAmountPence` (e.g., £0.05)
   - Stars awarded = `bidAmountPence / 10 * 2` (e.g., 0.5 → 1 star, but displayed as 2⭐)
   - Rivalry event created

**UI Terms**:
- "Claim" (first bid)
- "Steal" (outbid current champion)
- "Beat their offer" (action text)
- "Double Stars!" (reward message)

### Leaderboard Calculation

**Timeframe**: Weekly (Sunday 00:00 to Saturday 23:59)

```typescript
// api/src/controllers/leaderboard.ts
export const weekly = async (req, reply) => {
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  weekStart.setHours(0, 0, 0, 0)
  
  const completions = await prisma.completion.findMany({
    where: {
      familyId: req.claims.familyId,
      status: 'approved',
      timestamp: { gte: weekStart }
    },
    include: { assignment: { include: { chore: true } }, child: true }
  })
  
  // Aggregate by child
  const stats = completions.reduce((acc, c) => {
    const childId = c.childId
    if (!acc[childId]) {
      acc[childId] = {
        childId,
        child: c.child,
        completedChores: 0,
        totalRewardPence: 0,
        totalStars: 0
      }
    }
    acc[childId].completedChores++
    const rewardPence = c.assignment.chore.baseRewardPence
    acc[childId].totalRewardPence += rewardPence
    acc[childId].totalStars += Math.floor(rewardPence / 10)
    return acc
  }, {})
  
  // Sort by stars (primary), then reward (tiebreaker)
  const leaderboard = Object.values(stats)
    .sort((a, b) => {
      if (b.totalStars !== a.totalStars) return b.totalStars - a.totalStars
      return b.totalRewardPence - a.totalRewardPence
    })
    .map((stat, index) => ({ ...stat, rank: index + 1 }))
  
  return { leaderboard, weekStart }
}
```

---

## Performance & Scaling

### Current Capacity (v1.5)

- **Families**: 500
- **Users**: 2,000 (4 per family avg)
- **Requests/sec**: 50
- **Response Time**: 50-100ms (cached), 200-500ms (uncached)
- **Database Connections**: 10 per API instance
- **Cache Hit Rate**: 80-90%

### Bottlenecks & Solutions

| Bottleneck | Symptom | Solution |
|------------|---------|----------|
| **Database queries** | Slow leaderboard | Redis caching (5 min TTL) |
| **Single API instance** | CPU saturation | Horizontal scaling (3-5 replicas) |
| **PostgreSQL locks** | Slow writes | Read replicas for SELECT queries |
| **Redis memory** | Evictions | Redis Cluster (sharding) |
| **Static assets** | CDN bandwidth | Cloudflare CDN |

### Horizontal Scaling Plan

**Goal**: Support 1,000+ families (4,000+ users)

#### Step 1: Load Balancer

```yaml
# Add Nginx or Traefik
nginx:
  image: nginx:alpine
  ports:
    - "80:80"
    - "443:443"
  volumes:
    - ./nginx.conf:/etc/nginx/nginx.conf
  depends_on:
    - api
```

#### Step 2: Multiple API Instances

```yaml
api:
  deploy:
    replicas: 3
  environment:
    DATABASE_URL: ${DATABASE_URL}
    REDIS_HOST: redis
```

#### Step 3: Read Replicas

```yaml
postgres-replica:
  image: postgres:17-alpine
  environment:
    POSTGRES_MASTER_SERVICE_HOST: postgres
```

Update Prisma:
```typescript
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL, // Write
    },
    replica: {
      url: process.env.REPLICA_URL, // Read
    }
  }
})
```

#### Step 4: Redis Cluster

```bash
# Replace single Redis with cluster (3 masters, 3 replicas)
redis-cluster:
  image: redis:7.4-alpine
  command: redis-server --cluster-enabled yes
```

### Performance Monitoring

**Metrics to Track**:
- Request rate (req/sec)
- Response time (p50, p95, p99)
- Cache hit rate (%)
- Database query time (ms)
- Error rate (%)
- Memory usage (MB)
- CPU usage (%)

**Tools**:
- Prometheus + Grafana (metrics)
- Sentry (error tracking)
- New Relic / Datadog (APM)

---

## Security Considerations

### Authentication Security

1. **Magic Links**: 15-minute expiry, single-use
2. **Join Codes**: 7-day expiry, marked as used after joining
3. **JWT Tokens**: 7-day expiry, signed with HS256
4. **Rate Limiting**: 500 requests/min per IP

### Data Privacy

1. **Multi-Tenancy**: Strict `familyId` scoping prevents cross-family leaks
2. **PII Encryption**: TODO - Client-side encrypt `realNameCipher`, `dobCipher`
3. **Audit Logs**: All wallet transactions logged in `Transaction` table
4. **No Photo Proofs**: Removed to avoid GDPR/safeguarding issues

### Security Headers (Helmet.js)

```typescript
app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      fontSrc: ["'self'", "fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true
  }
})
```

### Input Validation

All endpoints validate input with Fastify schemas:

```typescript
app.post('/v1/completions', {
  schema: {
    body: {
      type: 'object',
      required: ['assignmentId'],
      properties: {
        assignmentId: { type: 'string', format: 'uuid' },
        proofUrl: { type: 'string', format: 'uri' },
        note: { type: 'string', maxLength: 500 }
      }
    }
  }
}, createCompletion)
```

### Secrets Management

**Dev**: `docker/dev.env` (gitignored)
**Prod**: Environment variables or AWS Secrets Manager

```bash
JWT_SECRET=your-secret-key-change-in-production
DATABASE_URL=postgresql://...
REDIS_HOST=redis
SMTP_HOST=smtp.sendgrid.net
SMTP_USER=apikey
SMTP_PASS=SG.xxx
```

---

## Deployment

### Docker Compose (Dev/Staging)

```bash
# Build and start all services
docker compose -f docker/docker-compose.yml --env-file docker/dev.env up --build

# Run migrations
docker compose -f docker/docker-compose.yml exec api npx prisma db push

# Seed database (optional)
docker compose -f docker/docker-compose.yml exec api npm run seed

# View logs
docker compose -f docker/docker-compose.yml logs -f api
```

### Production (AWS/GCP/Azure)

**Recommended Stack**:
- **Compute**: AWS ECS (Fargate) or GCP Cloud Run
- **Database**: AWS RDS PostgreSQL or GCP Cloud SQL
- **Cache**: AWS ElastiCache Redis or GCP Memorystore
- **CDN**: Cloudflare
- **Monitoring**: Datadog or New Relic

**Environment Variables**:
```bash
NODE_ENV=production
DATABASE_URL=postgresql://prod-user:password@rds.amazonaws.com:5432/choreblimey
REDIS_HOST=cache.amazonaws.com
JWT_SECRET=production-secret-key-min-32-chars
SMTP_HOST=smtp.sendgrid.net
SMTP_USER=apikey
SMTP_PASS=SG.production-key
FRONTEND_URL=https://choreblimey.com
```

**Health Checks**:
```bash
# API health endpoint
curl https://api.choreblimey.com/v1/health

# Expected response:
{ "status": "ok", "timestamp": "2025-10-21T12:00:00Z" }
```

---

## Development Workflow

### Setup

```bash
# 1. Clone repo
git clone https://github.com/dje115/choreblimey.git
cd choreblimey

# 2. Start services
docker compose -f docker/docker-compose.yml up --build

# 3. Run migrations
docker compose -f docker/docker-compose.yml exec api npx prisma db push

# 4. Access app
# Frontend: http://localhost:1500
# API: http://localhost:1501
# MailHog: http://localhost:1506
```

### Common Tasks

```bash
# Add a new migration
docker compose -f docker/docker-compose.yml exec api npx prisma migrate dev --name add_new_field

# Generate Prisma client after schema change
docker compose -f docker/docker-compose.yml exec api npx prisma generate

# View database in Prisma Studio
docker compose -f docker/docker-compose.yml exec api npx prisma studio

# Reset database (clear all data)
docker compose -f docker/docker-compose.yml exec api npx prisma migrate reset --force

# Run TypeScript type check
cd api && npm run type-check
cd web && npm run type-check

# Rebuild single service
docker compose -f docker/docker-compose.yml up -d --build api
```

### Git Workflow

**Commit Convention**: Conventional Commits

```bash
feat(api): add payout system for parents
fix(cache): invalidate family cache on child join
chore(docker): update postgres to v17
docs: add API documentation
```

**Branch Strategy**: Single `main` branch (production-ready)

### Code Review Checklist

- [ ] Types are explicit (no `any`)
- [ ] All queries scoped by `familyId`
- [ ] Cache invalidation on data updates
- [ ] Input validation with Fastify schemas
- [ ] Error handling with try/catch
- [ ] No secrets in code (use env vars)
- [ ] Mobile-responsive UI (≤390px width)
- [ ] Tested manually (parent + child flows)

---

## Appendix

### Useful Commands

```bash
# Check Redis cache stats
docker exec choreblimey-redis-1 redis-cli INFO stats

# View cached keys
docker exec choreblimey-redis-1 redis-cli KEYS "*"

# Clear Redis cache
docker exec choreblimey-redis-1 redis-cli FLUSHALL

# Check database size
docker compose -f docker/docker-compose.yml exec postgres psql -U choreblimey choreblimey -c "SELECT pg_size_pretty(pg_database_size('choreblimey'));"

# Backup database
docker compose -f docker/docker-compose.yml exec -T postgres pg_dump -U choreblimey choreblimey > backup.sql

# Restore database
docker compose -f docker/docker-compose.yml exec -T postgres psql -U choreblimey choreblimey < backup.sql
```

### External Resources

- **Prisma Docs**: https://www.prisma.io/docs
- **Fastify Docs**: https://fastify.dev
- **React Docs**: https://react.dev
- **Tailwind CSS**: https://tailwindcss.com
- **Docker Compose**: https://docs.docker.com/compose

---

**Last Updated**: October 21, 2025  
**Maintainer**: ChoreBlimey! Development Team  
**Version**: 1.5.0

