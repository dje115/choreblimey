# ChoreBlimey! Development Documentation

## 🎯 Project Overview

ChoreBlimey! is a gamified family chore management system that motivates children to complete household tasks through a star-based reward system, competitive elements, and real-time updates.

## 🏗️ Architecture

### Tech Stack
- **Backend**: Node.js + Fastify + TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Background Jobs**: BullMQ + Redis
- **Containerization**: Docker + Docker Compose
- **Authentication**: JWT + bcryptjs
- **Email**: Nodemailer + MailHog (dev) / SMTP (prod)
- **Affiliate Integration**: Amazon PA-API + SiteStripe

### Multi-Tenant Architecture
- **Tenant Unit**: Family (each family is isolated)
- **Data Scoping**: All queries scoped by `familyId`
- **Admin Portal**: Separate from parent/child dashboards
- **Authentication**: Role-based (parent_admin, child, admin)

## 📁 Project Structure

```
choreblimey/
├── api/                          # Backend API
│   ├── src/
│   │   ├── controllers/          # API route handlers
│   │   ├── services/             # Business logic layer
│   │   ├── utils/                # Utilities (auth, errors, validation)
│   │   ├── middleware/           # Express middleware
│   │   ├── db/                   # Database connection
│   │   └── routes/               # Route definitions
│   ├── prisma/
│   │   ├── schema.prisma         # Database schema
│   │   └── migrations/           # Database migrations
│   └── Dockerfile
├── web/                          # Frontend React app
│   ├── src/
│   │   ├── pages/                # React pages
│   │   ├── components/          # Reusable components
│   │   ├── contexts/            # React contexts
│   │   ├── lib/                 # API client & utilities
│   │   └── themes/              # Child theme system
│   └── Dockerfile
├── worker/                       # Background job processor
│   ├── src/
│   │   ├── jobs/                # Job definitions
│   │   └── jobs.ts              # Job scheduler
│   └── Dockerfile
├── docker/                       # Docker configuration
│   ├── docker-compose.yml       # Service orchestration
│   ├── dev.env                  # Environment variables
│   └── redis-acl.conf           # Redis permissions
└── docs/                         # Documentation
```

## 🗄️ Database Schema

### Core Models

#### Family & Users
```prisma
model Family {
  id                String   @id @default(uuid())
  nameCipher        String   // Encrypted family name
  region            String
  budgetPeriod      BudgetPeriod
  maxBudgetPence    Int?
  budgetStartDate   DateTime?
  showLifetimeEarnings Boolean @default(true)
  createdAt         DateTime @default(now())
  
  // Relations
  members           FamilyMember[]
  children          Child[]
  chores            Chore[]
  assignments       Assignment[]
  // ... other relations
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  createdAt DateTime @default(now())
  
  // Relations
  familyMembers FamilyMember[]
}

model FamilyMember {
  id       String @id @default(uuid())
  familyId String
  userId   String
  role     Role   // parent_admin, parent, child
  scopeJson Json? // Additional permissions
  
  // Relations
  family   Family @relation(fields: [familyId], references: [id])
  user     User   @relation(fields: [userId], references: [id])
}
```

#### Children & Chores
```prisma
model Child {
  id           String    @id @default(uuid())
  familyId     String
  nickname     String
  realNameCipher String? // Encrypted real name
  dobCipher    String?   // Encrypted date of birth
  ageGroup     AgeGroup
  gender       Gender
  theme        String    @default("superhero")
  birthMonth   Int?
  birthYear    Int?
  interestsJson Json?    // JSON array of interests
  
  // Relations
  family       Family @relation(fields: [familyId], references: [id])
  assignments  Assignment[]
  wallet       Wallet?
  // ... other relations
}

model Chore {
  id              String     @id @default(uuid())
  familyId        String
  title           String
  description     String?
  frequency       Frequency  // daily, weekly, once
  proof           ProofType  // none, note, photo
  baseRewardPence Int
  minBidPence     Int?
  maxBidPence     Int?
  startDate       DateTime?
  endDate         DateTime?
  active          Boolean    @default(true)
  
  // Relations
  family      Family       @relation(fields: [familyId], references: [id])
  assignments Assignment[]
}
```

#### Wallet & Transactions
```prisma
model Wallet {
  id        String @id @default(uuid())
  childId   String @unique
  balancePence Int @default(0)
  
  // Relations
  child        Child         @relation(fields: [childId], references: [id])
  transactions Transaction[]
}

model Transaction {
  id        String   @id @default(uuid())
  walletId  String
  type      TransactionType // credit, debit
  amountPence Int
  source    String?
  note      String?
  metaJson  Json?    // Additional metadata
  createdAt DateTime @default(now())
  
  // Relations
  wallet Wallet @relation(fields: [walletId], references: [id])
}
```

#### Admin System
```prisma
model Admin {
  id                String   @id @default(uuid())
  email             String   @unique
  passwordHash      String
  emailVerified     Boolean  @default(false)
  twoFactorEnabled  Boolean  @default(false)
  createdAt         DateTime @default(now())
  lastLoginAt       DateTime?
  
  // Relations
  twoFactorCodes TwoFactorCode[]
}

model TwoFactorCode {
  id        String   @id @default(uuid())
  adminId   String
  code      String
  expiresAt DateTime
  used      Boolean  @default(false)
  createdAt DateTime @default(now())
  
  // Relations
  admin Admin @relation(fields: [adminId], references: [id])
}
```

## 🔧 Development Setup

### Prerequisites
- Docker & Docker Compose
- Node.js 22+ (for local development)
- Git

### Quick Start
```bash
# Clone repository
git clone <repository-url>
cd choreblimey

# Start all services
docker compose -f docker/docker-compose.yml --env-file docker/dev.env up --build

# Access services
# - Web: http://localhost:1500
# - API: http://localhost:1501
# - MailHog: http://localhost:1506
# - Admin: http://localhost:1500/admin
```

### Environment Variables
```bash
# Database
DATABASE_URL="postgresql://postgres:password@postgres:5432/choreblimey"

# JWT
JWT_SECRET="your-secret-key"

# Email (Development)
SMTP_HOST="mailhog"
SMTP_PORT="1025"
SMTP_FROM="noreply@choreblimey.com"

# Email (Production)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

# Amazon Affiliate
AMAZON_ACCESS_KEY="your-access-key"
AMAZON_SECRET_KEY="your-secret-key"
AMAZON_PARTNER_TAG="your-partner-tag"
AMAZON_REGION="us-east-1"

# SiteStripe
SITESTRIPE_API_KEY="your-api-key"
SITESTRIPE_SECRET_KEY="your-secret-key"
SITESTRIPE_AFFILIATE_ID="your-affiliate-id"
SITESTRIPE_REGION="us"
```

## 🚀 API Endpoints

### Authentication
```typescript
POST /v1/auth/signup-parent     # Parent registration
POST /v1/auth/child-join        # Child joins with code
POST /v1/auth/generate-join-code # Generate child join code
```

### Family Management
```typescript
GET  /v1/family                 # Get family details
POST /v1/family                # Create family
PATCH /v1/family               # Update family
GET  /v1/family/members        # Get family members
GET  /v1/family/budget         # Get budget info
```

### Chore Management
```typescript
GET  /v1/chores                 # List chores
POST /v1/chores                 # Create chore
PATCH /v1/chores/:id            # Update chore
```

### Child Operations
```typescript
POST /v1/children               # Create child
PATCH /v1/children/:id         # Update child
```

### Wallet & Transactions
```typescript
GET  /v1/wallet/:childId        # Get wallet
POST /v1/wallet/:childId/credit # Credit wallet
POST /v1/wallet/:childId/debit  # Debit wallet
GET  /v1/wallet/:childId/transactions # Transaction history
```

### Admin Endpoints
```typescript
# Authentication
POST /v1/admin/auth/signup      # Admin signup
POST /v1/admin/auth/verify-email # Email verification
POST /v1/admin/auth/login       # Admin login
POST /v1/admin/auth/verify-2fa  # 2FA verification
POST /v1/admin/auth/logout      # Admin logout

# Site Configuration
GET  /v1/admin/email-config     # Get email config
PATCH /v1/admin/email-config    # Update email config
POST /v1/admin/test-email       # Test email

GET  /v1/admin/affiliate-config # Get affiliate config
PATCH /v1/admin/affiliate-config # Update affiliate config
POST /v1/admin/test-affiliate   # Test affiliate provider
```

## 🎨 Frontend Architecture

### Component Structure
```
web/src/
├── pages/
│   ├── ParentDashboard.tsx     # Main parent interface
│   ├── ChildDashboard.tsx      # Main child interface
│   ├── AdminDashboard.tsx      # Admin management
│   └── AdminLogin.tsx          # Admin authentication
├── components/
│   ├── ParentDashboard/        # Parent-specific components
│   ├── ChildDashboard/         # Child-specific components
│   └── shared/                 # Reusable components
├── contexts/
│   └── AuthContext.tsx         # Authentication state
├── lib/
│   ├── api.ts                  # API client
│   └── types.ts                # TypeScript types
└── themes/
    └── childThemes.ts          # Child theme system
```

### Real-Time Updates
The system implements real-time updates between parent and child dashboards:

```typescript
// Parent Dashboard - Notify children
const notifyChildDashboards = () => {
  window.dispatchEvent(new CustomEvent('choreUpdated'))
  localStorage.setItem('chore_updated', Date.now().toString())
}

// Child Dashboard - Listen for updates
useEffect(() => {
  const handleChoreUpdate = () => {
    loadDashboard() // Refresh data
  }
  
  window.addEventListener('choreUpdated', handleChoreUpdate)
  window.addEventListener('storage', handleStorageChange)
  
  return () => {
    window.removeEventListener('choreUpdated', handleChoreUpdate)
    window.removeEventListener('storage', handleStorageChange)
  }
}, [])
```

## 🔄 Background Jobs

### Job Types
```typescript
// Reward synchronization
interface SyncRewardsJob {
  type: 'sync-rewards'
  data: {
    sourceId: string
    provider: 'amazon' | 'sitestripe'
  }
}

// Price cache refresh
interface RefreshPriceCacheJob {
  type: 'refresh-price-cache'
  data: {
    itemIds: string[]
  }
}
```

### Job Scheduling
```typescript
// Daily reward sync
cron.schedule('0 2 * * *', async () => {
  await syncRewardsQueue.add('daily-sync', {
    type: 'sync-rewards',
    data: { sourceId: 'amazon-primary' }
  })
})

// Hourly price refresh
cron.schedule('0 * * * *', async () => {
  await refreshPriceQueue.add('hourly-refresh', {
    type: 'refresh-price-cache',
    data: { itemIds: await getActiveItemIds() }
  })
})
```

## 🎯 Key Features

### 1. Gamification
- **Star System**: 10 pence = 1 star
- **Streaks**: Daily completion bonuses
- **Leaderboards**: Weekly family competitions
- **Challenge Mode**: Bidding system for chores

### 2. Multi-Tenant Security
- **Family Isolation**: All data scoped by `familyId`
- **Role-Based Access**: Parent, child, admin roles
- **Data Encryption**: Sensitive data encrypted at rest

### 3. Real-Time Updates
- **Cross-Dashboard Sync**: Parent ↔ Child communication
- **Event-Driven**: Custom events + localStorage
- **Instant Feedback**: No manual refresh needed

### 4. Admin Portal
- **Site-Wide Configuration**: Email, affiliate settings
- **Multi-Provider Support**: Amazon PA-API + SiteStripe
- **Centralized Management**: All settings in one place

### 5. Affiliate Integration
- **Product Categorization**: Age and gender-based filtering
- **Price Monitoring**: Automatic price updates
- **Reward Recommendations**: Personalized suggestions

## 🧪 Testing

### API Testing
```bash
# Health check
curl http://localhost:1501/v1/health

# Test authentication
curl -X POST http://localhost:1501/v1/auth/signup-parent \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Database Testing
```bash
# Run migrations
docker compose exec api npx prisma migrate dev

# Seed test data
docker compose exec api npm run seed

# Create test user
docker compose exec api npx tsx src/create-test-user.ts
```

## 🚀 Deployment

### Production Build
```bash
# Build all services
docker compose -f docker/docker-compose.yml --env-file docker/prod.env up --build

# Run migrations
docker compose exec api npx prisma migrate deploy

# Seed initial data
docker compose exec api npm run seed
```

### Environment Configuration
```bash
# Production environment
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/choreblimey
JWT_SECRET=your-production-secret
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

## 📊 Monitoring & Logging

### Application Logs
```bash
# View API logs
docker compose logs -f api

# View worker logs
docker compose logs -f worker

# View all services
docker compose logs -f
```

### Database Monitoring
```bash
# Connect to database
docker compose exec postgres psql -U postgres -d choreblimey

# View tables
\dt

# Check data
SELECT * FROM "Family" LIMIT 5;
```

## 🔒 Security Considerations

### Data Protection
- **Encryption at Rest**: Sensitive fields encrypted
- **JWT Tokens**: Secure authentication
- **Input Validation**: Zod schemas for all inputs
- **SQL Injection Prevention**: Prisma ORM protection

### Multi-Tenant Security
- **Family Isolation**: All queries scoped by `familyId`
- **Role-Based Access**: Granular permissions
- **Admin Separation**: Isolated admin portal

### API Security
- **Rate Limiting**: 500 requests/minute
- **CORS Configuration**: Proper origin handling
- **Helmet Security**: Security headers
- **Input Sanitization**: XSS prevention

## 🛠️ Development Guidelines

### Code Style
- **TypeScript**: Strict mode enabled
- **ESLint**: Consistent code formatting
- **Prettier**: Automatic code formatting
- **Conventional Commits**: Standardized commit messages

### Component Guidelines
- **Functional Components**: Use React hooks
- **TypeScript Interfaces**: Define all props
- **Error Boundaries**: Handle component errors
- **Loading States**: User feedback for async operations

### API Guidelines
- **RESTful Design**: Standard HTTP methods
- **Error Handling**: Consistent error responses
- **Input Validation**: Zod schemas
- **Documentation**: JSDoc comments

## 📈 Performance Optimization

### Database
- **Indexes**: Optimized queries
- **Connection Pooling**: Efficient connections
- **Query Optimization**: Minimal data transfer

### Frontend
- **Code Splitting**: Lazy loading
- **Memoization**: React.memo for expensive components
- **Bundle Optimization**: Tree shaking
- **Caching**: localStorage for user preferences

### Background Jobs
- **Queue Management**: BullMQ for job processing
- **Rate Limiting**: API call throttling
- **Error Handling**: Retry mechanisms
- **Monitoring**: Job status tracking

## 🔄 CI/CD Pipeline

### Git Workflow
```bash
# Feature development
git checkout -b feature/new-feature
git add .
git commit -m "feat(api): add new endpoint"
git push origin feature/new-feature

# Create pull request
# Review and merge to main
```

### Automated Testing
- **Unit Tests**: Component and function tests
- **Integration Tests**: API endpoint tests
- **E2E Tests**: Full user journey tests
- **Performance Tests**: Load testing

## 📚 Additional Resources

### Documentation
- [Prisma Documentation](https://www.prisma.io/docs)
- [Fastify Documentation](https://www.fastify.io/docs/latest/)
- [React Documentation](https://react.dev/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

### Tools
- **Database GUI**: Prisma Studio
- **API Testing**: Postman/Insomnia
- **Email Testing**: MailHog
- **Redis GUI**: RedisInsight

### Monitoring
- **Application Metrics**: Custom dashboards
- **Error Tracking**: Sentry integration
- **Performance Monitoring**: Lighthouse CI
- **Uptime Monitoring**: Health check endpoints

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Last Updated**: January 2025
**Version**: 1.0.0
**Maintainer**: Development Team
