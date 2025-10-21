# ChoreBlimey! 🌟

**Turn chores into cheers!** A gamified family chore management app that makes household tasks fun and rewarding for kids.

[![Version](https://img.shields.io/badge/version-1.5.0-blue.svg)](https://github.com/dje115/choreblimey)
[![Docker](https://img.shields.io/badge/docker-compose-2496ED.svg)](https://www.docker.com/)
[![TypeScript](https://img.shields.io/badge/typescript-5.6-3178C6.svg)](https://www.typescriptlang.org/)

---

## 🎯 Overview

ChoreBlimey! is a full-stack TypeScript application that gamifies household chores for families. Parents manage tasks and pocket money, while children earn stars and compete in friendly challenges.

**Key Features:**
- 🎮 Gamified chore system with stars and rewards
- 🏆 Sibling rivalry with Challenge Mode (bidding system)
- 🔥 Streak tracking with milestone bonuses
- 💰 Pocket money management with payout tracking
- 🎨 7 customizable themes for children
- 📊 Leaderboards and activity feeds
- ⚡ Real-time updates with smart caching (500+ families capacity)

---

## 🏗️ Architecture

### Technology Stack

**Frontend:**
- React 18 + TypeScript
- Vite 7 (build tool)
- Tailwind CSS 3.4
- React Router 7
- Custom theme system

**Backend:**
- Fastify 4 (Node.js framework)
- Prisma 6 (ORM)
- PostgreSQL 17 (database)
- Redis 7.4 (caching/queue)
- JWT authentication

**Infrastructure:**
- Docker Compose (orchestration)
- BullMQ (background jobs)
- MailHog (dev email testing)

### Services

| Service | Port | Purpose |
|---------|------|---------|
| **Web** | 1500 | React frontend (Vite dev server) |
| **API** | 1501 | Fastify REST API |
| **PostgreSQL** | 1502 | Primary database |
| **MailHog UI** | 1506 | Email testing interface |
| **MailHog SMTP** | 2525 | SMTP server |
| **Redis** | 1507 | Cache + BullMQ queue |
| **Worker** | - | Background job processor |

---

## 🚀 Quick Start

### Prerequisites
- Docker Desktop (Windows/Mac) or Docker Engine + Docker Compose (Linux)
- Git
- 8GB+ RAM recommended

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/dje115/choreblimey.git
cd choreblimey

# 2. Start all services
docker compose -f docker/docker-compose.yml --env-file docker/dev.env up --build

# 3. Run database migrations
docker compose -f docker/docker-compose.yml exec api npx prisma db push

# 4. Access the app
# Frontend: http://localhost:1500
# API: http://localhost:1501
# MailHog: http://localhost:1506
```

### First-Time Setup

1. **Sign up as a parent** at http://localhost:1500
2. Check MailHog (http://localhost:1506) for your magic link
3. Click the link to log in
4. **Invite children** via the "Invite" button
5. Children use the join code to create their accounts
6. **Create chores** and assign them to children
7. Children complete chores and earn stars!

---

## 📁 Project Structure

```
choreblimey/
├── api/                      # Backend (Fastify + Prisma)
│   ├── prisma/
│   │   └── schema.prisma    # Database schema
│   ├── src/
│   │   ├── controllers/     # API endpoint handlers
│   │   ├── routes/          # Route definitions
│   │   ├── utils/           # Helpers (auth, cache, email, etc.)
│   │   ├── db/              # Database connection
│   │   └── server.ts        # Entry point
│   └── package.json
│
├── web/                      # Frontend (React + Vite)
│   ├── src/
│   │   ├── pages/           # Dashboard components
│   │   ├── components/      # Reusable UI components
│   │   ├── contexts/        # React contexts (auth, theme)
│   │   ├── lib/             # API client
│   │   ├── themes/          # Child theme system
│   │   └── main.tsx         # Entry point
│   └── package.json
│
├── worker/                   # Background jobs (BullMQ)
│   ├── src/
│   │   └── jobs.ts          # Job definitions
│   └── package.json
│
├── docker/                   # Docker configuration
│   ├── docker-compose.yml   # Service orchestration
│   ├── dev.env              # Environment variables
│   └── redis-acl.conf       # Redis ACL config
│
├── infra/docker/            # Dockerfiles
│   ├── api.Dockerfile
│   ├── web.Dockerfile
│   └── worker.Dockerfile
│
└── docs/                     # Documentation
    ├── TECHNICAL_SPEC.md    # Full technical specification
    ├── API.md               # API endpoint documentation
    ├── DATABASE.md          # Database schema guide
    ├── DESIGN.md            # UI/UX design system
    └── PERFORMANCE.md       # Performance optimization guide
```

---

## 📚 Documentation

- **[Technical Specification](TECHNICAL_SPEC.md)** - Complete system architecture
- **[API Documentation](API.md)** - All endpoints with examples
- **[Database Schema](DATABASE.md)** - Entity relationships and models
- **[Design System](DESIGN.md)** - UI/UX guidelines and components
- **[Performance Guide](PERFORMANCE.md)** - Caching and scaling strategies
- **[Contributing Guide](CONTRIBUTING.md)** - Development workflow

---

## 🎨 Key Features

### For Parents
- ✅ Passwordless magic link authentication
- ✅ Create and manage chores with rewards
- ✅ Approve/reject chore completions
- ✅ Track pocket money and process payouts
- ✅ Set weekly/monthly budgets
- ✅ View leaderboards and activity feeds
- ✅ Manage family members and settings

### For Children
- ✅ Join code authentication (text or QR)
- ✅ Personalized dashboard with their name
- ✅ 7 customizable themes (Superhero, Unicorn, Ocean, etc.)
- ✅ Complete chores and earn stars
- ✅ Track streaks with milestone bonuses
- ✅ Challenge Mode: bid on chores for double stars
- ✅ View transaction history (Bank tab)
- ✅ Claim rewards from the shop

### Gamification
- 🌟 **Stars System**: 1 star = 10 pence (£0.10)
- 🔥 **Streaks**: Consecutive completions earn bonus stars
- ⚔️ **Challenge Mode**: Siblings bid lower to "steal" chores for 2x stars
- 🏆 **Leaderboards**: Weekly rankings by stars earned
- 💰 **Wallet**: Track balance, lifetime earnings, and payouts

---

## 🛠️ Development

### Running in Development Mode

All services run in Docker with hot-reload enabled:

```bash
# Start all services
docker compose -f docker/docker-compose.yml up

# View logs
docker logs choreblimey-api-1 -f
docker logs choreblimey-web-1 -f

# Run Prisma commands
docker compose -f docker/docker-compose.yml exec api npx prisma studio
docker compose -f docker/docker-compose.yml exec api npx prisma migrate dev

# Clear database (for testing)
docker compose -f docker/docker-compose.yml exec api npx prisma migrate reset --force
```

### Code Style

- **TypeScript**: Strict mode enabled
- **Naming**: camelCase (code), kebab-case (files), PascalCase (components/models)
- **Linting**: ESLint with strict rules
- **No `any`**: Use proper types
- **Async/await**: Preferred over promises

### Multi-Tenant Safety

⚠️ **CRITICAL**: All database queries MUST filter by `familyId` to prevent data leaks across families.

```typescript
// ✅ GOOD
const chores = await prisma.chore.findMany({
  where: { familyId }
})

// ❌ BAD - exposes all families' data
const chores = await prisma.chore.findMany()
```

---

## 🧪 Testing

### Manual Testing Workflow

1. **Parent Flow**:
   - Sign up → Receive magic link → Log in
   - Create family (auto-generated if not exists)
   - Invite children → Get join codes
   - Create chores → Assign to children
   - Approve/reject completions
   - Process payouts

2. **Child Flow**:
   - Use join code → Create account
   - Select theme
   - View "Today" chores
   - Complete chores → Submit for approval
   - Bid on Challenge Mode chores
   - View Bank → See transaction history

### Health Checks

```bash
# API health
curl http://localhost:1501/v1/health

# Check Redis connection
docker logs choreblimey-api-1 | grep "Redis"

# Check database
docker compose -f docker/docker-compose.yml exec api npx prisma db pull
```

---

## 📊 Performance

**Current Capacity:**
- ✅ **500 families** (2000 users)
- ✅ **50 requests/second**
- ✅ **80-90% cache hit rate**
- ✅ **50-100ms** response time (cached)

**Optimization:**
- Redis caching (5 min for leaderboards, 1 min for family data)
- Smart cache invalidation on updates
- Database indexes on `familyId`, `childId`, `status`
- Rate limiting: 500 req/min

See [PERFORMANCE.md](PERFORMANCE.md) for scaling strategies.

---

## 🔐 Security

- **Authentication**: JWT tokens (7-day expiry)
- **Passwordless**: Magic links (15-min expiry) + Join codes (7-day expiry)
- **Rate Limiting**: 500 requests/min per IP
- **Headers**: Helmet.js for security headers
- **Multi-Tenant**: Strict `familyId` scoping
- **Secrets**: All sensitive data in `docker/dev.env` (gitignored)

⚠️ **TODO**: Client-side encryption for child PII (realNameCipher, dobCipher)

---

## 🐛 Troubleshooting

### API not starting
```bash
docker logs choreblimey-api-1
# Common issues: Prisma schema out of sync, Redis not connected
docker compose -f docker/docker-compose.yml exec api npx prisma generate
```

### Database errors
```bash
# Reset and recreate schema
docker compose -f docker/docker-compose.yml exec api npx prisma db push --force-reset
```

### Port conflicts
```bash
# Change ports in docker/docker-compose.yml
ports:
  - "1500:1500"  # Change first number (host port)
```

### Cache issues (stale data)
```bash
# Clear Redis cache
docker exec choreblimey-redis-1 redis-cli FLUSHALL
```

---

## 🚧 Roadmap

### High Priority
- [ ] Client-side encryption for child PII
- [ ] Photo proof uploads (re-add MinIO or use S3)
- [ ] Push notifications for chore reminders
- [ ] Reward catalog with affiliate links
- [ ] Team-Up cooperative missions

### Medium Priority
- [ ] Dark mode for teens
- [ ] Voice feedback mode (accessibility)
- [ ] Weekly family challenges
- [ ] Analytics dashboard for parents
- [ ] Export reports (CSV/PDF)

### Low Priority
- [ ] Multi-language support (i18n)
- [ ] Mobile apps (React Native)
- [ ] Social features (friend leaderboards)
- [ ] Gamified progression (level badges)

---

## 📝 License

This project is proprietary and confidential. All rights reserved.

---

## 🙏 Acknowledgments

- Built with ❤️ for families who want to make chores fun!
- Inspired by the ChoreBlimey! brand: fun, family-friendly, accessible

---

## 📞 Support

For technical questions or issues:
- Check [TECHNICAL_SPEC.md](TECHNICAL_SPEC.md) for architecture details
- Review logs: `docker logs choreblimey-api-1`
- Consult [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow

**Turn chores into cheers!** 🎉

