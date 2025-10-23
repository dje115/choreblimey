# ChoreBlimey! AI Development Guide

## 🤖 AI Development Context

This document provides comprehensive context for AI assistants working on the ChoreBlimey! project, including system architecture, development patterns, and specific implementation details.

## 🎯 Project Overview

**ChoreBlimey!** is a gamified family chore management system that motivates children to complete household tasks through a star-based reward system, competitive elements, and real-time updates.

### Core Value Proposition
- **Gamification**: Star-based rewards, streaks, leaderboards
- **Family Management**: Multi-tenant, role-based access
- **Real-Time Updates**: Cross-dashboard synchronization
- **Admin Control**: Site-wide configuration and management
- **Affiliate Integration**: Amazon PA-API and SiteStripe support

## 🏗️ Technical Architecture

### Tech Stack
```typescript
// Backend
Node.js + Fastify + TypeScript
PostgreSQL + Prisma ORM
BullMQ + Redis (Background Jobs)
JWT + bcryptjs (Authentication)
Nodemailer (Email Service)

// Frontend  
React + Vite + TypeScript
Tailwind CSS (Styling)
React Context (State Management)
Custom Event System (Real-time Updates)

// Infrastructure
Docker + Docker Compose
Multi-tenant Architecture
Role-based Security
```

### Multi-Tenant Design
- **Tenant Unit**: Family (complete isolation)
- **Data Scoping**: All queries scoped by `familyId`
- **Admin Portal**: Separate from parent/child dashboards
- **Authentication**: Role-based (parent_admin, child, admin)

## 🗄️ Database Schema Context

### Core Models for AI Understanding

#### Family & User Management
```typescript
// Family is the tenant unit
model Family {
  id                String   @id @default(uuid())
  nameCipher        String   // Encrypted family name
  region            String
  budgetPeriod      BudgetPeriod
  maxBudgetPence    Int?
  showLifetimeEarnings Boolean @default(true)
  
  // Relations - ALL data scoped by familyId
  members           FamilyMember[]
  children          Child[]
  chores            Chore[]
  assignments       Assignment[]
  completions       Completion[]
  wallets           Wallet[]
  transactions      Transaction[]
  rewards           Reward[]
  redemptions       Redemption[]
}

// Users can belong to multiple families
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  createdAt DateTime @default(now())
  
  familyMembers FamilyMember[]
}

// Family membership with roles
model FamilyMember {
  id       String @id @default(uuid())
  familyId String
  userId   String
  role     Role   // parent_admin, parent, child
  scopeJson Json? // Additional permissions
  
  family   Family @relation(fields: [familyId], references: [id])
  user     User   @relation(fields: [userId], references: [id])
}
```

#### Child & Chore System
```typescript
// Children belong to families
model Child {
  id           String    @id @default(uuid())
  familyId     String    // CRITICAL: Always scope by this
  nickname     String
  realNameCipher String? // Encrypted real name
  dobCipher    String?   // Encrypted date of birth
  ageGroup     AgeGroup  // 5-8, 9-11, 12-15, 16-18
  gender       Gender    // male, female, other
  theme        String    @default("superhero")
  birthMonth   Int?      // For birthday lists
  birthYear    Int?      // For birthday lists
  interestsJson Json?    // JSON array of interests
  
  // Relations
  family       Family @relation(fields: [familyId], references: [id])
  assignments  Assignment[]
  wallet       Wallet?
  transactions Transaction[]
  completions  Completion[]
  redemptions  Redemption[]
}

// Chores are family-specific
model Chore {
  id              String     @id @default(uuid())
  familyId        String     // CRITICAL: Always scope by this
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

#### Wallet & Transaction System
```typescript
// Each child has one wallet
model Wallet {
  id        String @id @default(uuid())
  childId   String @unique
  balancePence Int @default(0) // Balance in pence (1/100 of currency)
  
  child        Child         @relation(fields: [childId], references: [id])
  transactions Transaction[]
}

// All financial transactions
model Transaction {
  id        String   @id @default(uuid())
  walletId  String
  type      TransactionType // credit, debit
  amountPence Int
  source    String?
  note      String?
  metaJson  Json?    // Additional metadata (completionId, redemptionId, etc.)
  createdAt DateTime @default(now())
  
  wallet Wallet @relation(fields: [walletId], references: [id])
}
```

#### Admin System
```typescript
// Site administrators (separate from family users)
model Admin {
  id                String   @id @default(uuid())
  email             String   @unique
  passwordHash      String
  emailVerified     Boolean  @default(false)
  twoFactorEnabled  Boolean  @default(false)
  createdAt         DateTime @default(now())
  lastLoginAt       DateTime?
  
  twoFactorCodes TwoFactorCode[]
}

// 2FA codes for admin authentication
model TwoFactorCode {
  id        String   @id @default(uuid())
  adminId   String
  code      String
  expiresAt DateTime
  used      Boolean  @default(false)
  createdAt DateTime @default(now())
  
  admin Admin @relation(fields: [adminId], references: [id])
}
```

## 🔧 Development Patterns

### Multi-Tenant Security Pattern
```typescript
// ALWAYS scope queries by familyId
const getChoresByFamily = async (familyId: string) => {
  return prisma.chore.findMany({
    where: { familyId }, // CRITICAL: Never forget this
    orderBy: { createdAt: 'desc' }
  })
}

// Authentication middleware adds familyId to request
interface Claims {
  sub: string
  role: string
  familyId: string  // CRITICAL: Always present
  email?: string
  childId?: string
}
```

### Error Handling Pattern
```typescript
// Consistent error handling
enum ErrorCode {
  VALIDATION_INVALID_INPUT = 'VALIDATION_INVALID_INPUT',
  AUTH_UNAUTHORIZED = 'AUTH_UNAUTHORIZED',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  SYSTEM_DATABASE_ERROR = 'SYSTEM_DATABASE_ERROR'
}

// Structured error responses
const sendError = (reply: FastifyReply, code: ErrorCode, message: string, statusCode: number, details?: any) => {
  reply.status(statusCode).send({
    error: message,
    code,
    details,
  })
}
```

### Real-Time Updates Pattern
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

## 🎨 Frontend Architecture Context

### Component Structure
```
web/src/
├── pages/
│   ├── ParentDashboard.tsx     # Main parent interface
│   ├── ChildDashboard.tsx      # Main child interface (5 tabs)
│   ├── AdminDashboard.tsx      # Admin management
│   ├── AdminLogin.tsx          # Admin authentication
│   ├── AdminSignup.tsx         # Admin registration
│   ├── AdminTwoFactor.tsx      # 2FA verification
│   ├── AdminEmailVerify.tsx    # Email verification
│   ├── AdminMailConfig.tsx     # Email configuration
│   └── AdminAffiliateConfig.tsx # Affiliate configuration
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

### Child Dashboard Tabs
1. **Today**: Active chores and completions
2. **Streaks**: Streak tracking and milestones
3. **Shop**: Reward redemption
4. **Showdown**: Challenge mode (bidding system)
5. **Bank**: Transaction history and balance

### Real-Time Update System
- **Parent → Child**: Custom events + localStorage
- **Triggers**: Chore creation, completion approval, payouts
- **Implementation**: Event listeners in child dashboard

## 🔄 API Endpoints Context

### Authentication Endpoints
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
GET  /v1/chores                 # List chores (scoped by familyId)
POST /v1/chores                 # Create chore
PATCH /v1/chores/:id            # Update chore
```

### Child Operations
```typescript
POST /v1/children               # Create child
PATCH /v1/children/:id         # Update child (birthday, theme, etc.)
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

## 🎯 Key Features Context

### 1. Gamification System
- **Star System**: 10 pence = 1 star (configurable)
- **Streaks**: Daily completion bonuses with milestones
- **Leaderboards**: Weekly family competitions
- **Challenge Mode**: Bidding system for chores (Showdown tab)

### 2. Multi-Tenant Security
- **Family Isolation**: All data scoped by `familyId`
- **Role-Based Access**: Parent, child, admin roles
- **Data Encryption**: Sensitive fields encrypted at rest
- **Admin Separation**: Isolated admin portal

### 3. Real-Time Updates
- **Cross-Dashboard Sync**: Parent ↔ Child communication
- **Event-Driven**: Custom events + localStorage
- **Instant Feedback**: No manual refresh needed
- **Triggers**: Chore creation, completion approval, payouts

### 4. Admin Portal
- **Site-Wide Configuration**: Email, affiliate settings
- **Multi-Provider Support**: Amazon PA-API + SiteStripe
- **Centralized Management**: All settings in one place
- **Authentication**: Email/password + 2FA

### 5. Affiliate Integration
- **Product Categorization**: Age and gender-based filtering
- **Price Monitoring**: Automatic price updates
- **Reward Recommendations**: Personalized suggestions
- **Multi-Provider**: Amazon PA-API + SiteStripe support

## 🔄 Background Jobs Context

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
- **Daily Sync**: 2:00 AM - Sync all reward sources
- **Hourly Refresh**: Every hour - Update price cache
- **On-Demand**: Manual triggers from admin portal

## 🛠️ Development Guidelines for AI

### Code Style Requirements
- **TypeScript**: Strict mode enabled, no `any` types
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

### Security Requirements
- **Multi-Tenant**: Always scope by `familyId`
- **Input Validation**: Zod schemas for all inputs
- **Error Handling**: Structured error responses
- **Authentication**: JWT tokens with proper scoping

## 🧪 Testing Context

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

## 🚀 Deployment Context

### Development Environment
```bash
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

## 🔍 Common Development Tasks

### Adding New Features
1. **Database**: Update Prisma schema, run migrations
2. **API**: Add controllers, services, routes
3. **Frontend**: Add components, pages, API calls
4. **Testing**: Update tests, verify functionality
5. **Documentation**: Update docs, add JSDoc comments

### Debugging Issues
1. **Check logs**: `docker compose logs -f api`
2. **Database**: Connect with Prisma Studio
3. **Frontend**: Check browser console, React DevTools
4. **Real-time**: Verify event listeners
5. **Authentication**: Check JWT tokens, familyId scoping

### Performance Optimization
1. **Database**: Add indexes, optimize queries
2. **Frontend**: Use React.memo, code splitting
3. **API**: Add caching, rate limiting
4. **Background Jobs**: Optimize job processing

## 📊 Monitoring & Debugging

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

## 🎯 AI Development Best Practices

### When Working on This Project
1. **Always scope by familyId**: Never forget multi-tenant security
2. **Use TypeScript strictly**: No `any` types, proper interfaces
3. **Follow error handling patterns**: Use structured error responses
4. **Implement real-time updates**: Notify child dashboards of changes
5. **Add comprehensive documentation**: JSDoc comments for all functions
6. **Test thoroughly**: Verify multi-tenant isolation
7. **Consider user experience**: Real-time updates, loading states
8. **Maintain security**: Input validation, authentication checks

### Common Patterns to Follow
- **Multi-tenant queries**: Always include `familyId` in where clauses
- **Error handling**: Use `sendError` function for consistent responses
- **Input validation**: Use Zod schemas for all inputs
- **Real-time updates**: Call `notifyChildDashboards()` after changes
- **TypeScript**: Define interfaces for all data structures
- **Documentation**: Add JSDoc comments to all exported functions

---

This guide provides comprehensive context for AI assistants working on the ChoreBlimey! project, ensuring consistent development practices and understanding of the system architecture.
