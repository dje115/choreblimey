# ChoreBlimey! Technical Architecture

## 🏗️ System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        ChoreBlimey! System                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │   Web Frontend  │    │   API Backend   │    │   Worker     │ │
│  │   (React)       │    │   (Fastify)     │    │   (BullMQ)   │ │
│  │   Port: 1500    │    │   Port: 1501    │    │   Background │ │
│  └─────────────────┘    └─────────────────┘    └──────────────┘ │
│           │                        │                        │    │
│           │                        │                        │    │
│           ▼                        ▼                        ▼    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    Data Layer                               │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │ │
│  │  │ PostgreSQL  │  │    Redis    │  │    External APIs    │ │ │
│  │  │ (Database)  │  │  (Cache +   │  │  (Amazon PA-API,    │ │ │
│  │  │             │  │   Jobs)     │  │   SiteStripe)       │ │ │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                External Services                            │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │ │
│  │  │   MailHog   │  │   SMTP      │  │   Admin Portal      │ │ │
│  │  │ (Dev Email) │  │ (Prod Email)│  │   (Site Config)     │ │ │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 🔄 Data Flow Architecture

### 1. User Authentication Flow
```
User → Web Frontend → API Backend → Database
  ↓
JWT Token → Local Storage → API Requests
```

### 2. Real-Time Updates Flow
```
Parent Dashboard → Custom Event → Child Dashboard
     ↓                    ↓              ↓
localStorage → Storage Event → Dashboard Refresh
```

### 3. Background Job Flow
```
API Request → Queue Job → Worker Process → Database Update
     ↓            ↓           ↓              ↓
External API → Redis Queue → BullMQ → PostgreSQL
```

## 🗄️ Database Architecture

### Multi-Tenant Design
```
Family (Tenant)
├── Family Members (Users)
├── Children
├── Chores
├── Assignments
├── Completions
├── Wallets
├── Transactions
├── Rewards
└── Redemptions
```

### Key Relationships
- **Family** → **FamilyMember** (1:many)
- **Family** → **Child** (1:many)
- **Family** → **Chore** (1:many)
- **Child** → **Wallet** (1:1)
- **Wallet** → **Transaction** (1:many)
- **Chore** → **Assignment** (1:many)
- **Assignment** → **Completion** (1:many)

## 🔐 Security Architecture

### Authentication Layers
```
┌─────────────────────────────────────────────────────────────┐
│                    Security Layers                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   JWT Tokens    │  │   Role-Based    │  │   Data      │ │
│  │   (Stateless)   │  │   Access        │  │   Encryption│ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   Input         │  │   Rate          │  │   CORS      │ │
│  │   Validation    │  │   Limiting      │  │   Protection│ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Multi-Tenant Security
- **Family Isolation**: All queries scoped by `familyId`
- **Data Encryption**: Sensitive fields encrypted at rest
- **Role-Based Access**: Granular permissions per role
- **Admin Separation**: Isolated admin portal

## 🎨 Frontend Architecture

### Component Hierarchy
```
App
├── AuthContext (Global State)
├── Routes
│   ├── ParentDashboard
│   │   ├── ChoreManagement
│   │   ├── FamilyManagement
│   │   └── ActivityFeed
│   ├── ChildDashboard
│   │   ├── TodayTab
│   │   ├── StreaksTab
│   │   ├── ShopTab
│   │   ├── ShowdownTab
│   │   └── BankTab
│   └── AdminDashboard
│       ├── EmailConfig
│       ├── AffiliateConfig
│       └── SiteManagement
└── Shared Components
    ├── Toast
    ├── Confetti
    └── Modals
```

### State Management
- **React Context**: Global authentication state
- **Local State**: Component-specific state
- **Real-Time Updates**: Event-driven communication
- **Persistence**: localStorage for user preferences

## 🔄 API Architecture

### RESTful Design
```
/v1/
├── auth/                    # Authentication
│   ├── signup-parent
│   ├── child-join
│   └── generate-join-code
├── family/                  # Family management
│   ├── GET /
│   ├── POST /
│   └── PATCH /
├── chores/                  # Chore management
│   ├── GET /
│   ├── POST /
│   └── PATCH /:id
├── children/                # Child management
│   ├── POST /
│   └── PATCH /:id
├── wallet/                  # Wallet operations
│   ├── GET /:childId
│   ├── POST /:childId/credit
│   └── POST /:childId/debit
└── admin/                   # Admin operations
    ├── auth/
    ├── email-config
    └── affiliate-config
```

### Error Handling
```typescript
interface APIError {
  code: ErrorCode
  message: string
  details?: any
}

enum ErrorCode {
  VALIDATION_INVALID_INPUT = 'VALIDATION_INVALID_INPUT',
  AUTH_UNAUTHORIZED = 'AUTH_UNAUTHORIZED',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  SYSTEM_DATABASE_ERROR = 'SYSTEM_DATABASE_ERROR'
}
```

## 🔄 Background Job Architecture

### Job Types
```typescript
// Reward Synchronization
interface SyncRewardsJob {
  type: 'sync-rewards'
  data: {
    sourceId: string
    provider: 'amazon' | 'sitestripe'
  }
}

// Price Cache Refresh
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

## 📊 Monitoring & Observability

### Application Metrics
- **API Response Times**: Endpoint performance
- **Database Queries**: Query optimization
- **Background Jobs**: Job success/failure rates
- **User Activity**: Dashboard usage patterns

### Error Tracking
- **API Errors**: Structured error logging
- **Database Errors**: Prisma error handling
- **Background Job Errors**: Retry mechanisms
- **Frontend Errors**: React error boundaries

## 🚀 Deployment Architecture

### Development Environment
```
Docker Compose
├── web (React Dev Server)
├── api (Node.js + Fastify)
├── worker (BullMQ Worker)
├── postgres (PostgreSQL)
├── redis (Redis + BullMQ)
└── mailhog (Email Testing)
```

### Production Environment
```
Load Balancer
├── Web Servers (React Build)
├── API Servers (Node.js + Fastify)
├── Worker Servers (Background Jobs)
├── Database Cluster (PostgreSQL)
├── Cache Cluster (Redis)
└── Email Service (SMTP)
```

## 🔧 Development Workflow

### Code Organization
```
src/
├── controllers/          # API route handlers
├── services/            # Business logic
├── utils/               # Utilities
├── middleware/          # Express middleware
├── db/                  # Database connection
└── routes/              # Route definitions
```

### Testing Strategy
- **Unit Tests**: Individual function testing
- **Integration Tests**: API endpoint testing
- **E2E Tests**: Full user journey testing
- **Performance Tests**: Load testing

### CI/CD Pipeline
```
Git Push → Build → Test → Deploy
    ↓        ↓      ↓       ↓
  GitHub → Docker → Jest → Production
```

## 📈 Performance Optimization

### Database Optimization
- **Indexes**: Optimized query performance
- **Connection Pooling**: Efficient database connections
- **Query Optimization**: Minimal data transfer
- **Caching**: Redis for frequently accessed data

### Frontend Optimization
- **Code Splitting**: Lazy loading of components
- **Memoization**: React.memo for expensive components
- **Bundle Optimization**: Tree shaking and minification
- **Caching**: localStorage for user preferences

### API Optimization
- **Rate Limiting**: Prevent abuse
- **Caching**: Redis for expensive operations
- **Compression**: Gzip compression
- **CDN**: Static asset delivery

## 🔒 Security Considerations

### Data Protection
- **Encryption at Rest**: Sensitive data encrypted
- **Encryption in Transit**: HTTPS/TLS
- **Input Validation**: Zod schemas
- **SQL Injection Prevention**: Prisma ORM

### Authentication Security
- **JWT Tokens**: Stateless authentication
- **Password Hashing**: bcryptjs
- **2FA Support**: Email-based 2FA
- **Session Management**: Token expiration

### API Security
- **CORS Configuration**: Proper origin handling
- **Rate Limiting**: Request throttling
- **Input Sanitization**: XSS prevention
- **Security Headers**: Helmet.js

## 🛠️ Development Tools

### Backend Tools
- **Prisma Studio**: Database GUI
- **Postman**: API testing
- **RedisInsight**: Redis GUI
- **Docker**: Containerization

### Frontend Tools
- **React DevTools**: Component debugging
- **Redux DevTools**: State debugging
- **Lighthouse**: Performance auditing
- **Chrome DevTools**: Browser debugging

### Monitoring Tools
- **Application Logs**: Structured logging
- **Error Tracking**: Sentry integration
- **Performance Monitoring**: Custom metrics
- **Uptime Monitoring**: Health checks

---

This architecture document provides a comprehensive overview of the ChoreBlimey! system design, implementation details, and operational considerations for AI development and maintenance.
