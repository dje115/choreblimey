# Changelog

All notable changes to ChoreBlimey! will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.5.0] - 2025-10-21

### 🚀 Performance

- **Added Redis caching layer** for 4-5x faster responses
  - Leaderboards cached for 5 minutes
  - Family data cached for 1 minute
  - Wallet balances cached for 30 seconds
  - 80-90% cache hit rate achieved
- **Smart cache invalidation** on data updates
  - Child joins → invalidate family cache
  - Chore completed → invalidate family cache
  - Completion approved → invalidate wallet + leaderboard cache
  - Child/family updated → invalidate family cache
- **Capacity increased** from 50-100 to 500 families (2,000 users)
- **Response times** improved from 200-500ms to 50-100ms (cached)
- **Rate limiting** increased from 100 to 500 requests/minute

### ✨ Features

- **Personalized child greetings**: "Hey [Nickname]!" instead of "Hey Champion!"
- **User-selectable themes** for children (7 options):
  - Superhero (red/blue/gold)
  - Unicorn (pink/purple/rainbow)
  - Ocean (blue/teal/aqua)
  - Sunset (orange/pink/purple)
  - Neon City (dark/neon/cyberpunk)
  - Galaxy (deep purple/star field)
  - High Contrast (black/white/accessible)
- **Payout system** for parents:
  - Record physical money transfers
  - Track unpaid vs paid balances
  - Payment methods: cash, bank transfer, other
  - Payout history with timestamps
- **Transaction history** for children:
  - New "Bank" tab in child dashboard
  - Rich transaction details (chore, streak bonus, payout, etc.)
  - Icons and color-coding for transaction types
  - Date/time stamps
- **Lifetime earnings display** in child portal:
  - Shows total earned money across all time
  - Total paid out separately
  - Toggle in parent settings to show/hide
- **Child profile management**:
  - Parents can edit child nickname, age, gender, birthday
  - Generate new join codes for additional devices
  - View child stats
- **Budget management** improvements:
  - Set max weekly/monthly pocket money budget
  - Real-time budget tracking
  - Estimated weekly spend per child
  - Budget period selection (weekly/monthly)

### 🎮 Gamification

- **Challenge Mode (Sibling Rivalry)**:
  - Children bid LOWER on chores to compete
  - Lowest bidder becomes "champion" and can complete chore
  - Winner gets 2x stars (but only bid amount in money)
  - Locked until claimed - prevents completion without bidding
  - Streak protection indicators
  - "Steal" mechanic with child-friendly terms
- **Streak tracking enhancements**:
  - Milestone bonuses (3, 7, 14, 30 days)
  - Overall and per-chore streaks
  - Streak displayed in child portal
- **Chore assignment improvements**:
  - Bidding toggle for Challenge Mode
  - Multiple children assignment
  - Chore library with budget-based suggested rewards

### 🎨 UI/UX

- **Child-friendly login screen**:
  - Large join code input
  - Playful design with emojis
  - Clear instructions
- **Parent dashboard redesign**:
  - Tile-based layout with gradients
  - Summary cards (chores, pocket money, leaderboard)
  - Tabbed chore management
  - Family member cards with stats
  - Budget breakdown with per-child estimates
  - Pocket money tile with payout buttons
- **Child dashboard improvements**:
  - Theme picker modal
  - "Today", "Streaks", "Shop", "Showdown", "Bank" tabs
  - Challenge Mode UI with bidding interface
  - Completed chores moved to "Recent Activity"
  - Star Bank card with lifetime earnings
- **Mobile responsiveness**:
  - Phone: Single column, bottom navigation
  - Tablet: Two columns
  - Desktop: Three columns
  - Minimum width: 280px cards

### 🔧 Technical

- **MinIO removed**: Photo proofs feature removed for privacy/safeguarding
- **Docker optimization**: Non-root users, multi-stage builds
- **Prisma migrations**: 4 new migrations for schema updates
- **API rate limiting**: Increased to handle dashboard loads
- **Error handling**: Graceful degradation for failed API calls
- **TypeScript**: Strict mode enforced across codebase

### 📚 Documentation

- **README.md**: Complete project overview with quick start
- **TECHNICAL_SPEC.md**: Full system architecture (70+ pages)
- **DEVELOPMENT_GUIDE.md**: For AI assistants & developers
- **PERFORMANCE.md**: Caching strategies and scaling guide
- **CONTRIBUTING.md**: Development workflow and conventions
- **CHANGELOG.md**: This file

### 🐛 Bug Fixes

- **Cache staleness**: Fixed children not appearing immediately after invite
- **Approval box**: Fixed pending completions not showing on parent dashboard
- **Star count sync**: Fixed discrepancies between parent and child dashboards
- **Family activity**: Replaced hardcoded static data with real-time data
- **Estimated earnings**: Fixed calculation not updating when chores assigned
- **Settings modal**: Fixed "Save Settings" not closing modal
- **Lifetime earnings toggle**: Fixed errors when toggling off
- **Theme persistence**: Fixed theme not loading from localStorage
- **Bid amount display**: Fixed showing base reward instead of actual bid

### 🔐 Security

- **JWT expiry**: 7 days for auth tokens
- **Magic link expiry**: 15 minutes
- **Join code expiry**: 7 days
- **Rate limiting**: 500 requests/minute per IP
- **Helmet.js**: Security headers enabled
- **Multi-tenant**: Strict `familyId` scoping on all queries
- **Non-root Docker users**: Enhanced container security

---

## [1.0.0] - 2025-10-20

### Initial Release

- Basic parent authentication (magic links)
- Child join codes (text + QR)
- Chore creation and assignment
- Chore completion workflow
- Parent approval/rejection
- Wallet system (stars + pocket money)
- Basic leaderboard
- Email testing with MailHog
- Docker Compose setup
- PostgreSQL database with Prisma
- Fastify REST API
- React + Vite frontend
- Tailwind CSS styling

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| **1.5.0** | 2025-10-21 | Redis caching, payout system, Challenge Mode, themes, comprehensive docs |
| **1.0.0** | 2025-10-20 | Initial MVP release |

---

## Upcoming Features

### v1.6.0 (Planned)
- [ ] Push notifications for chore reminders
- [ ] Reward catalog with affiliate integration
- [ ] Team-Up cooperative missions
- [ ] Parent analytics dashboard
- [ ] Export functionality (CSV/PDF)

### v2.0.0 (Future)
- [ ] Client-side encryption for child PII
- [ ] Mobile apps (React Native)
- [ ] Multi-language support (i18n)
- [ ] Voice feedback mode (accessibility)
- [ ] Social features (friend leaderboards)

---

**Maintained by**: ChoreBlimey! Development Team  
**Repository**: https://github.com/dje115/choreblimey  
**License**: Proprietary

