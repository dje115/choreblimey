# ChoreBlimey! 🧹⭐

A gamified family chore management system that motivates children to complete household tasks through a star-based reward system, competitive elements, and real-time updates.

## 🎯 Overview

ChoreBlimey! transforms household chores into an engaging game where children earn stars for completing tasks, build streaks, compete with siblings, and redeem rewards. Parents can manage chores, approve completions, and track family progress through an intuitive dashboard.

## ✨ Key Features

### 🎮 Gamification
- **Star System**: Earn stars for completing chores (10p = 1⭐)
- **Streaks**: Configurable streak protection, bonuses, and penalties (UI complete, backend pending)
- **Leaderboards**: Weekly family competitions
- **Challenge Mode**: Bidding system for chores (Showdown tab)
- **Automated Chore Generation**: Daily and weekly chores regenerate automatically

### 👨‍👩‍👧‍👦 Family Management
- **Multi-Tenant**: Each family is completely isolated
- **Role-Based Access**: Parent, child, co-parent, grandparent, and admin roles
- **Real-Time Updates**: Instant synchronization between dashboards
- **Child Profiles**: Age-appropriate themes and customization
- **Extended Family**: Support for multiple parents and grandparents

### 🏆 Competitive Elements
- **Showdown Mode**: Children can bid on chores to win double stars
- **Streak Protection**: Defend your streaks from siblings
- **Weekly Leaderboards**: Track family performance
- **Bonus Rewards**: Streak bonuses and rivalry multipliers

### 🌍 Internationalization
- **Multi-Language Support**: Romanian and English with easy switching
- **Currency Support**: USD, EUR, GBP, RON with localized formatting
- **Cultural Adaptation**: Region-specific content and features

### 🛍️ Reward System
- **Affiliate Integration**: Amazon PA-API and SiteStripe support
- **Product Categorization**: Age and gender-based filtering
- **Price Monitoring**: Automatic price updates
- **Redemption Tracking**: Full reward fulfillment workflow

### 🔧 Secure Admin Portal
- **Isolated Architecture**: Separate admin-api and admin-web containers
- **Network Security**: Dedicated admin network with proper segmentation
- **Real-Time Monitoring**: Live system stats, memory usage, and service health
- **Email Configuration**: Support for MailHog only, Real SMTP only, or Both modes for testing
- **Account Cleanup**: Automated inactive account management with real audit logs
- **Security Management**: View login attempts, audit logs, and revoke sessions
- **System Monitoring**: Performance metrics, uptime tracking, and database health
- **Multi-Provider Support**: Amazon PA-API + SiteStripe for affiliate rewards
- **Enhanced Authentication**: Email/password + 2FA security
- **Audit Trail**: Complete logging of all admin actions

## 🏗️ Architecture

### Tech Stack
- **Backend**: Node.js + Fastify + TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Background Jobs**: BullMQ + Redis
- **Containerization**: Docker + Docker Compose
- **Authentication**: JWT + bcryptjs
- **Email**: Nodemailer + MailHog (dev) / SMTP (prod)

### Multi-Tenant Design
- **Tenant Unit**: Family (complete data isolation)
- **Data Scoping**: All queries scoped by `familyId`
- **Admin Portal**: Separate from parent/child dashboards
- **Security**: Role-based access with encrypted sensitive data

### Secure Architecture
- **Service Isolation**: Admin services separated from user services
- **Network Segmentation**: Dedicated networks for admin, user, and database services
- **Container Security**: Minimal attack surface with Alpine Linux
- **Health Monitoring**: Comprehensive health checks for all services
- **Email Security**: Isolated email service with proper authentication

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 22+ (for local development)
- Git

### Installation

#### Secure Development Stack (Recommended)
```bash
# Clone repository
git clone <repository-url>
cd choreblimey

# Start all services (secure stack)
docker compose -f docker/docker-compose-secure.yml --env-file docker/dev-secure.env up --build -d

# Access services
# - Web: http://localhost:1500
# - API: http://localhost:1501
# - Admin API: http://localhost:1503
# - Admin Web: http://localhost:1504
# - MailHog: http://localhost:1506

# Run database migrations
docker exec choreblimey-secure-api-1 npx prisma migrate dev --name init

# Seed database (optional)
docker exec choreblimey-secure-api-1 npm run seed

# Check service health
curl http://localhost:1501/v1/health
```

**Version**: v0.0.8 (as of latest commit)

### 📖 Docker Development Guide
For detailed Docker setup, troubleshooting, and development workflow, see [DOCKER_DEVELOPMENT.md](./DOCKER_DEVELOPMENT.md).

**⚠️ Important**: Always use the `choreblimey-secure` stack for development. The legacy `choreblimey` stack is deprecated.

### First Time Setup
```bash
# Run database migrations (SECURE STACK)
docker exec choreblimey-secure-api-1 npx prisma migrate dev --name init

# Seed demo data
docker exec choreblimey-secure-api-1 npm run seed

# Create test user
docker exec choreblimey-secure-api-1 npx tsx src/create-test-user.ts
```

## 📱 User Interfaces

### Parent Dashboard
- **Chore Management**: Create, edit, and assign chores
- **Family Management**: Invite children and manage family
- **Approval System**: Review and approve chore completions
- **Payout System**: Pay out earned stars to children
- **Activity Feed**: Track family progress and completions

### Child Dashboard
- **Today Tab**: Active chores and completion tracking
- **Streaks Tab**: Streak tracking and milestone rewards
- **Shop Tab**: Browse and redeem rewards
- **Showdown Tab**: Challenge mode and bidding system
- **Bank Tab**: Transaction history and balance

### Admin Portal
- **Email Configuration**: Site-wide email settings
- **Affiliate Configuration**: Amazon and SiteStripe setup
- **Site Management**: Centralized control panel
- **Authentication**: Secure admin access with 2FA

## 🔄 Real-Time Updates

The system implements real-time synchronization between parent and child dashboards:

- **Chore Updates**: New chores appear instantly on child dashboards
- **Completion Approvals**: Children see approved completions immediately
- **Payouts**: Wallet balances update in real-time
- **Reward Fulfillments**: Redemption status updates instantly

## 🎨 Child Themes

Children can choose from multiple themes:
- **Superhero**: Classic hero theme with bold colors
- **Princess**: Elegant pink and purple theme
- **Space**: Cosmic adventure theme
- **Ocean**: Underwater exploration theme
- **Forest**: Nature and animal theme

## 🔒 Security Features

### Multi-Tenant Security
- **Family Isolation**: Complete data separation between families
- **Role-Based Access**: Granular permissions per role
- **Data Encryption**: Sensitive information encrypted at rest
- **Admin Separation**: Isolated admin portal
- **Auto-Delete**: Inactive accounts automatically deleted (6 months inactive, 12 months suspended)
- **Login Tracking**: Monitors family activity for proper account management

### Authentication
- **JWT Tokens**: Stateless authentication
- **Password Hashing**: bcryptjs for secure password storage
- **2FA Support**: Email-based two-factor authentication
- **Session Management**: Token expiration and refresh

### API Security
- **Input Validation**: Zod schemas for all inputs
- **Rate Limiting**: 500 requests/minute per user
- **CORS Configuration**: Proper origin handling
- **SQL Injection Prevention**: Prisma ORM protection

## ⚙️ Background Workers

### Auto-Delete System
- **Monthly Cleanup**: Runs monthly to maintain database hygiene
- **6-Month Rule**: Inactive accounts (no login for 6 months) are automatically deleted
- **12-Month Rule**: Suspended accounts are deleted after 12 months
- **Email Warnings**: 30-day advance notice before deletion
- **Cascade Deletion**: Properly removes all related data (children, chores, etc.)

### Other Workers
- **Reward Sync**: Nightly sync with affiliate providers (3:00 AM)
- **Popularity Updates**: Hourly popularity score calculations
- **Birthday Bonuses**: Daily birthday bonus awards (6:00 AM)
- **Price Cache**: 6-hourly price cache refresh

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

## 📊 Monitoring

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

## 📚 Documentation

- **[Development Guide](DEVELOPMENT.md)**: Comprehensive development documentation
- **[Architecture Guide](docs/ARCHITECTURE.md)**: Technical architecture overview
- **[AI Development Guide](docs/AI_DEVELOPMENT.md)**: AI assistant development context

## 🛠️ Development

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

## 🔄 Background Jobs

### Job Types
- **Reward Synchronization**: Daily sync of affiliate products
- **Price Cache Refresh**: Hourly price updates
- **Email Processing**: Background email sending
- **Data Cleanup**: Periodic maintenance tasks

### Job Scheduling
- **Daily Sync**: 2:00 AM - Sync all reward sources
- **Hourly Refresh**: Every hour - Update price cache
- **On-Demand**: Manual triggers from admin portal

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

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🎯 Roadmap

### Phase 1: Core Features ✅
- [x] Multi-tenant family management
- [x] Chore creation and assignment
- [x] Star-based reward system
- [x] Real-time updates
- [x] Admin portal

### Phase 2: Gamification ✅
- [x] Streak tracking
- [x] Challenge mode (Showdown)
- [x] Leaderboards
- [x] Child themes

### Phase 3: Affiliate Integration ✅
- [x] Amazon PA-API integration
- [x] SiteStripe support
- [x] Product categorization
- [x] Price monitoring

### Phase 4: Advanced Features (Planned)
- [ ] Mobile app
- [ ] Push notifications
- [ ] Advanced analytics
- [ ] Social features

---

**ChoreBlimey!** - Making chores fun for the whole family! 🧹⭐

**Last Updated**: October 2025  
**Version**: 1.6.0  
**Maintainer**: Development Team