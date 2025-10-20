# ChoreBlimey! — FULL Build Spec (v1.3, Web‑First, Inline Code)

> **Single-file master spec** for Cursor/Codex. Web-first (React + Fastify + Docker), with multi-tenant families, sibling rivalry, team-ups, in-app reporting (no CSV), and Amazon rewards. Includes Docker, Prisma schema, API skeletons, worker jobs, UI themes, component code, and acceptance tests.

---

## 1) Project Overview

**ChoreBlimey!** gamifies household chores. Kids earn pocket money, stars, and bonuses; siblings can compete (underbids, streak steals) or cooperate (team-ups). Parents/relatives manage, approve, and gift bonuses. One app adapts to the signed-in role (parent/child/relative) and child’s age tier (5–8, 9–11, 12–15).

**Non‑negotiables**: strict TypeScript, Dockerized services on ports **1500–1550**, client-side encryption (libsodium) for child PII, RLS-style isolation at the API layer by `familyId`, in-app reporting (no CSV), multi-admin parents, relatives with caps, rivalry auto-hide if single child.

---

## 2) Tech Stack

- **Frontend**: React 18 + Vite + TypeScript + Tailwind + Framer Motion
- **Backend**: Node 20 + Fastify + Prisma (PostgreSQL)
- **Storage**: MinIO (S3-compatible) for photo proofs
- **Auth**: Magic link (email) for parents/relatives; code join for children
- **Jobs**: Worker (Node) + BullMQ (Redis) for streaks/penalties/retention
- **CI/CD**: GitHub Actions; deploy to ECS/Fly/Cloud Run
- **Ports**: web:1500, api:1501, postgres:1502, minio:1504/1505, mailhog:1506, redis:1507, nginx:1510

---

## 3) Docker Setup

**docker/docker-compose.yml**
```yaml
version: "3.9"
networks: { choreblimey_net: { driver: bridge } }
volumes: { pgdata: {}, minio-data: {} }

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: choreblimey
      POSTGRES_PASSWORD: choreblimey
      POSTGRES_DB: choreblimey
    ports: ["1502:5432"]
    networks: [choreblimey_net]
    volumes: [ "pgdata:/var/lib/postgresql/data" ]

  redis:
    image: redis:7-alpine
    ports: ["1507:6379"]
    networks: [choreblimey_net]

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minio
      MINIO_ROOT_PASSWORD: minio12345
    ports: ["1504:9000","1505:9001"]
    networks: [choreblimey_net]
    volumes: ["minio-data:/data"]

  mailhog:
    image: mailhog/mailhog:latest
    ports: ["1506:8025","2525:1025"]
    networks: [choreblimey_net]

  api:
    build: { context: ./api, dockerfile: ../infra/docker/api.Dockerfile }
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://choreblimey:choreblimey@postgres:5432/choreblimey
      JWT_SECRET: devblimeysecret
      S3_ENDPOINT: http://minio:9000
      S3_ACCESS_KEY: minio
      S3_SECRET_KEY: minio12345
      S3_BUCKET: proofs
      SMTP_HOST: mailhog
      SMTP_PORT: 1025
      SMTP_FROM: no-reply@choreblimey.local
      REDIS_URL: redis://redis:6379
    ports: ["1501:1501"]
    depends_on: [postgres, minio, redis]
    networks: [choreblimey_net]

  web:
    build: { context: ./web, dockerfile: ../infra/docker/web.Dockerfile }
    environment: { VITE_API_BASE_URL: http://localhost:1501 }
    ports: ["1500:1500"]
    depends_on: [api]
    networks: [choreblimey_net]

  worker:
    build: { context: ./worker, dockerfile: ../infra/docker/worker.Dockerfile }
    environment:
      DATABASE_URL: postgresql://choreblimey:choreblimey@postgres:5432/choreblimey
      REDIS_URL: redis://redis:6379
      S3_ENDPOINT: http://minio:9000
      S3_ACCESS_KEY: minio
      S3_SECRET_KEY: minio12345
      S3_BUCKET: proofs
    depends_on: [postgres, redis, minio]
    networks: [choreblimey_net]
```

**infra/docker/api.Dockerfile**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
EXPOSE 1501
CMD ["npm","run","dev"]
```

**infra/docker/web.Dockerfile**
```dockerfile
FROM node:20-alpine as deps
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 1500
CMD ["npm","run","dev","--","--host","0.0.0.0","--port","1500"]
```

**infra/docker/worker.Dockerfile**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["npm","run","start:worker"]
```

---

## 4) Database Schema (Prisma)

**db/prisma/schema.prisma**
```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

model Family {
  id           String   @id @default(uuid())
  createdAt    DateTime @default(now())
  nameCipher   String
  region       String?
  members      FamilyMember[]
  children     Child[]
  chores       Chore[]
  rewards      Reward[]
  audit        AuditLog[]
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  createdAt DateTime @default(now())
  members   FamilyMember[]
  transactions Transaction[]
}

enum Role {
  parent_admin
  parent_viewer
  relative_contributor
  child_player
}

model FamilyMember {
  id        String   @id @default(uuid())
  familyId  String
  userId    String
  role      Role
  invitedBy String?
  createdAt DateTime @default(now())
  scopeJson Json?

  family    Family  @relation(fields: [familyId], references: [id])
  user      User    @relation(fields: [userId], references: [id])

  @@index([familyId, role])
}

model Child {
  id           String   @id @default(uuid())
  familyId     String
  nickname     String
  realNameCipher String?
  dobCipher    String?
  avatarId     String?
  ageGroup     String?
  createdAt    DateTime @default(now())

  family       Family   @relation(fields: [familyId], references: [id])
  streaks      Streak[]
  wallets      Wallet[]
  assignments  Assignment[]
  bids         Bid[]
  completions  Completion[]
  redemptions  Redemption[]

  @@index([familyId])
}

enum Frequency { daily weekly once }
enum ProofType { none photo note }
enum BidStatus { open won lost }
enum CompletionStatus { pending approved rejected }

model Chore {
  id          String   @id @default(uuid())
  familyId    String
  title       String
  description String?
  frequency   Frequency
  proof       ProofType @default(none)
  baseRewardPence Int
  minBidPence Int?
  maxBidPence Int?
  startDate   DateTime?
  endDate     DateTime?
  active      Boolean  @default(true)

  family      Family   @relation(fields: [familyId], references: [id])
  assignments Assignment[]
  @@index([familyId, active])
}

model Assignment {
  id          String  @id @default(uuid())
  choreId     String
  familyId    String
  childId     String?
  biddingEnabled Boolean @default(false)
  linkedAssignmentId String?

  chore       Chore   @relation(fields: [choreId], references: [id])
  family      Family  @relation(fields: [familyId], references: [id])
  child       Child?  @relation(fields: [childId], references: [id])
  bids        Bid[]
  completions Completion[]

  @@index([familyId, childId])
}

model Bid {
  id        String   @id @default(uuid())
  assignmentId String
  familyId  String
  childId   String
  amountPence Int
  status    BidStatus @default(open)
  disruptTargetChildId String?
  createdAt DateTime @default(now())

  assignment Assignment @relation(fields: [assignmentId], references: [id])
  family     Family     @relation(fields: [familyId], references: [id])
  child      Child      @relation(fields: [childId], references: [id])

  @@index([familyId, assignmentId, status])
}

model Completion {
  id        String   @id @default(uuid())
  assignmentId String
  familyId  String
  childId   String
  timestamp DateTime @default(now())
  proofUrl  String?
  note      String?
  status    CompletionStatus @default(pending)

  assignment Assignment @relation(fields: [assignmentId], references: [id])
  family     Family     @relation(fields: [familyId], references: [id])
  child      Child      @relation(fields: [childId], references: [id])

  @@index([familyId, childId, status])
}

model Streak {
  id        String   @id @default(uuid())
  familyId  String
  childId   String
  choreId   String
  current   Int      @default(0)
  best      Int      @default(0)
  lastIncrementDate DateTime?
  isDisrupted Boolean @default(false)

  family    Family   @relation(fields: [familyId], references: [id])
  child     Child    @relation(fields: [childId], references: [id])
  chore     Chore    @relation(fields: [choreId], references: [id])

  @@index([familyId, childId, choreId])
}

model BonusRule {
  id        String   @id @default(uuid())
  familyId  String
  ruleJson  Json
  enabled   Boolean  @default(true)

  family    Family   @relation(fields: [familyId], references: [id])
  @@index([familyId, enabled])
}

model PenaltyRule {
  id        String   @id @default(uuid())
  familyId  String
  ruleJson  Json
  enabled   Boolean  @default(true)

  family    Family   @relation(fields: [familyId], references: [id])
  @@index([familyId, enabled])
}

model Wallet {
  id        String   @id @default(uuid())
  familyId  String
  childId   String
  balancePence Int   @default(0)

  family    Family   @relation(fields: [familyId], references: [id])
  child     Child    @relation(fields: [childId], references: [id])

  transactions Transaction[]
  @@index([familyId, childId])
}

enum TxType { credit debit }
enum TxSource { system parent relative }

model Transaction {
  id        String   @id @default(uuid())
  walletId  String
  familyId  String
  type      TxType
  amountPence Int
  source    TxSource @default(system)
  metaJson  Json?
  createdAt DateTime @default(now())

  wallet    Wallet   @relation(fields: [walletId], references: [id])
  family    Family   @relation(fields: [familyId], references: [id])

  @@index([familyId, createdAt])
}

enum RewardType { affiliate custom }

model Reward {
  id        String   @id @default(uuid())
  familyId  String
  type      RewardType
  sku       String?
  title     String
  imageUrl  String?
  amazonUrl String?
  affiliateTag String?
  starsRequired Int
  pricePence Int?
  ageTag    String?
  createdAt DateTime @default(now())

  family    Family   @relation(fields: [familyId], references: [id])
  redemptions Redemption[]

  @@index([familyId, type])
}

model Redemption {
  id        String   @id @default(uuid())
  rewardId  String
  familyId  String
  childId   String
  status    String   @default("pending")
  createdAt DateTime @default(now())

  reward    Reward @relation(fields: [rewardId], references: [id])
  family    Family @relation(fields: [familyId], references: [id])
  child     Child  @relation(fields: [childId], references: [id])
}

model RivalryEvent {
  id        String   @id @default(uuid())
  familyId  String
  actorChildId String
  targetChildId String?
  type      String
  amountPence Int?
  createdAt DateTime @default(now())
  metaJson  Json?

  family    Family @relation(fields: [familyId], references: [id])

  @@index([familyId, createdAt])
}

model AuditLog {
  id        String   @id @default(uuid())
  familyId  String
  actorId   String?
  action    String
  target    String?
  metaJson  Json?
  createdAt DateTime @default(now())

  family    Family @relation(fields: [familyId], references: [id])

  @@index([familyId, createdAt])
}
```

---

## 5) API Endpoints (Fastify + TS)

**api/src/server.ts**
```ts
import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import { routes } from './routes'
import { authPlugin } from './utils/auth'

const app = Fastify({ logger: true })
await app.register(cors, { origin: true, credentials: true })
await app.register(multipart)
await app.register(authPlugin)
await app.register(routes, { prefix: '/v1' })

app.listen({ port: 1501, host: '0.0.0.0' })
```

**api/src/utils/auth.ts**
```ts
import fp from 'fastify-plugin'
import jwt from 'jsonwebtoken'
export type Claims = { sub: string; role: string; familyId: string }
declare module 'fastify' { interface FastifyRequest { claims?: Claims } }

export const authPlugin = fp(async (app) => {
  app.decorateRequest('claims', null)
  app.addHook('preHandler', async (req, _res) => {
    if (req.routerPath?.includes('/auth/')) return
    const header = req.headers.authorization || ''
    const token = header.replace('Bearer ', '')
    if (!token) throw app.httpErrors.unauthorized()
    const claims = jwt.verify(token, process.env.JWT_SECRET!) as Claims
    req.claims = claims
    req.headers['x-cb-family'] = claims.familyId
  })
})
```

**api/src/routes/index.ts**
```ts
import { FastifyInstance } from 'fastify'
import * as ctrl from '../controllers'
export async function routes(app: FastifyInstance) {
  app.post('/auth/signup-parent', ctrl.auth.signupParent)
  app.post('/auth/callback', ctrl.auth.callback)
  app.post('/family', ctrl.family.create)
  app.post('/family/invite', ctrl.family.invite)
  app.post('/children', ctrl.children.create)
  app.get('/chores', ctrl.chores.list)
  app.post('/chores', ctrl.chores.create)
  app.patch('/chores/:id', ctrl.chores.update)
  app.post('/assignments', ctrl.assignments.create)
  app.post('/assignments/link', ctrl.assignments.link)
  app.post('/bids/compete', ctrl.bids.compete)
  app.post('/completions', ctrl.completions.create)
  app.post('/completions/:id/approve', ctrl.completions.approve)
  app.get('/wallet/:childId', ctrl.wallet.get)
  app.post('/wallet/:childId/credit', ctrl.wallet.credit)
  app.post('/wallet/:childId/debit', ctrl.wallet.debit)
  app.get('/leaderboard', ctrl.leaderboard.weekly)
  app.get('/rivalry-feed', ctrl.rivalry.feed)
  app.get('/rewards', ctrl.rewards.list)
  app.post('/redemptions', ctrl.rewards.redeem)
}
```

**Example controllers (snippets)**
```ts
// bids.compete
export async function compete(req, reply) {
  const { familyId } = req.claims!
  const { assignmentId, childId, amountPence, targetChildId } = req.body as any
  const a = await prisma.assignment.findFirst({ where:{ id:assignmentId, familyId, biddingEnabled:true }, include:{ chore:true } })
  if (!a) return reply.badRequest('Invalid assignment')
  const min = a.chore.minBidPence ?? Math.floor(a.chore.baseRewardPence*0.5)
  const max = a.chore.maxBidPence ?? Math.floor(a.chore.baseRewardPence*1.5)
  const amt = Math.max(min, Math.min(max, amountPence))
  const bid = await prisma.bid.create({ data:{ assignmentId, familyId, childId, amountPence:amt, disruptTargetChildId: targetChildId } })
  await prisma.rivalryEvent.create({ data:{ familyId, actorChildId: childId, targetChildId, type:'underbid', amountPence: amt } })
  return { ok:true, bid }
}

// completions.approve
export async function approve(req, reply) {
  const { familyId } = req.claims!; const { id } = req.params as any
  const c = await prisma.completion.update({ where:{ id }, data:{ status:'approved' } })
  const a = await prisma.assignment.findFirst({ where:{ id:c.assignmentId, familyId }, include:{ chore:true } })
  if (!a) return reply.notFound()
  const reward = a.chore.baseRewardPence
  const w = await prisma.wallet.upsert({
    where: { childId_familyId: { childId: c.childId, familyId } } as any,
    update: { balancePence: { increment: reward } },
    create: { familyId, childId: c.childId, balancePence: reward }
  })
  return { ok:true, wallet:w }
}
```

---

## 6) Worker (BullMQ)

```ts
import { Queue, Worker } from 'bullmq'; import { prisma } from './prisma'
const q = new Queue('nightly', { connection: { url: process.env.REDIS_URL! } })
new Worker('nightly', async () => {
  const families = await prisma.family.findMany({ select:{ id:true } })
  for (const {id} of families) await processFamily(id)
})
async function processFamily(familyId:string){
  // Apply penalties, compute streaks, check team-ups, prune media
}
```

---

## 7) UI Design System & Components

**tokens.json** (excerpt already shown above).

**@cb-ui components** included: `Card`, `ChoreCard`, `RivalryFeedItem`, `RewardsCarousel` (see code above).

**Rules**: adaptive themes per role/age; rivalry auto-hide with <2 children; affiliate links hidden in child view; WCAG AA; reduced-motion support.

---

## 8) Acceptance Tests (Summary)

- UI switches per role/age without reload; tokens applied
- Rivalry hidden for single-child families
- Underbid clamps and disruption flag toggles
- Team-up window bonus granted to both
- Reports accurate, share links expire in 24h
- Relative caps enforced; attempts audited
- All API queries scoped by familyId; cross-family denied

---

## 9) Setup Notes

1. `docker compose up --build` (web 1500, api 1501, db 1502, minio 1504/1505, mailhog 1506)
2. `prisma migrate dev && prisma db seed` (seed chores & rules)
3. Login parent via magic link (check MailHog UI on :1506)
4. Create family, kids, enable rivalry/team-ups, test UI modes

---

**End of v1.3 FULL** — place this file as `/SPEC.md` in your repo root and use Cursor/Codex to scaffold services and UI.
