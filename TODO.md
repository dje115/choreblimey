# ChoreBlimey! TODO List

## 🔥 High Priority - UI & Backend Integration

### 1. Implement Tabbed Settings Modal ⚙️
**Status**: UI Design Complete (JSX structure needs refinement)
**Description**: Replace the current non-tabbed Settings modal with a tabbed version
**Tabs Required**:
- ⚔️ **Rivalry**: Sibling Rivalry settings (enable/disable, underbid difference, friendly mode)
- 💰 **Budget**: Budget Management (period, max budget, per-child breakdown, lifetime earnings toggle)
- 🔧 **Account**: Email Management, Account Management (Suspend/Delete), Account Actions (Edit Family/Logout)

**Implementation Notes**:
- Follow the pattern established in Streak Settings Modal (working reference)
- Each tab must return a single parent element (avoid "Adjacent JSX elements" error)
- Preserve all Unicode/emojis: ⚙️ ⚔️ 💰 🔧 📧 ⚠️ ⏸️ 🗑️ ✏️ 👋
- Keep mobile-friendly horizontal tab scrolling
- Ensure all existing features are preserved

**Files to Modify**:
- `web/src/pages/ParentDashboard.tsx` (Settings Modal section)

**Testing Checklist**:
- [ ] All three tabs render correctly
- [ ] Budget updates save and persist
- [ ] No duplicate React key warnings
- [ ] All emojis display properly
- [ ] Mobile responsive tabs work
- [ ] Edit Family and Logout buttons function correctly

---

### 2. Implement Streak Bonus/Penalty Backend 🔥
**Status**: Frontend UI Complete, Backend Implementation Pending
**Description**: Wire up the comprehensive Streak Settings UI to the backend

**Frontend Complete** (`web/src/pages/ParentDashboard.tsx`):
- 📊 Overview Tab: Summary + Protection Days slider
- 🎁 Bonuses Tab: Enable/disable, days to bonus (3-30), bonus type (money/stars/both), amounts
- ⚠️ Penalties Tab: Enable/disable, penalty type (money/stars/both), escalating tiers (1st/2nd/3rd miss)
- 🛡️ Protection Tab: Minimum balance protection (never drop below X money/stars)

**Backend Tasks Required**:

#### A. Database Schema (`api/prisma/schema.prisma`)
Add to `Family` model:
```prisma
model Family {
  // ... existing fields ...
  
  // Streak Settings
  streakProtectionDays    Int      @default(1)
  
  // Bonuses
  bonusEnabled            Boolean  @default(true)
  bonusDays               Int      @default(7)
  bonusMoneyPence         Int      @default(50)
  bonusStars              Int      @default(5)
  bonusType               String   @default("both") // 'money' | 'stars' | 'both'
  
  // Penalties
  penaltyEnabled          Boolean  @default(true)
  firstMissPence          Int      @default(10)
  firstMissStars          Int      @default(1)
  secondMissPence         Int      @default(25)
  secondMissStars         Int      @default(3)
  thirdMissPence          Int      @default(50)
  thirdMissStars          Int      @default(5)
  penaltyType             String   @default("both") // 'money' | 'stars' | 'both'
  
  // Protection
  minBalancePence         Int      @default(100)
  minBalanceStars         Int      @default(10)
}
```

#### B. API Endpoints (`api/src/controllers/family.ts`)
- **GET `/v1/family`**: Include streak settings in response
- **PUT `/v1/family`**: Accept and update streak settings
- **POST `/v1/family/streak-settings`**: Dedicated endpoint for streak settings (optional)

#### C. Worker Job Enhancement (`worker/src/jobs/choreGeneration.ts`)
Update `processStreaks()` function:
1. Fetch family's streak settings
2. Apply protection days before penalties
3. Calculate and apply appropriate bonus/penalty tier
4. Check minimum balance before deducting (never go below minimums)
5. Log all streak actions to audit trail

#### D. Streak Calculation Logic
```typescript
// Pseudo-code for worker
function processChildStreak(child, family) {
  const missedDays = calculateMissedDays(child)
  
  // Protection grace period
  if (missedDays <= family.streakProtectionDays) {
    return // No penalty yet
  }
  
  // Calculate penalty tier
  const penaltyTier = missedDays > family.streakProtectionDays + 2 ? 3 
                    : missedDays > family.streakProtectionDays + 1 ? 2 
                    : 1
  
  // Apply penalty (respecting minimum balance)
  if (family.penaltyEnabled) {
    const penaltyMoney = getTierPenalty(penaltyTier, family, 'money')
    const penaltyStars = getTierPenalty(penaltyTier, family, 'stars')
    
    deductWithProtection(child, penaltyMoney, penaltyStars, family)
  }
  
  // Check for bonus eligibility
  if (family.bonusEnabled && child.streakDays >= family.bonusDays) {
    applyBonus(child, family)
  }
}
```

**Testing Checklist**:
- [ ] Streak settings save correctly to database
- [ ] Protection days work (no penalty during grace period)
- [ ] Bonuses applied after X consecutive days
- [ ] Penalties escalate correctly (1st/2nd/3rd miss)
- [ ] Minimum balance protection works (never drop below threshold)
- [ ] Both money and stars handled based on type setting
- [ ] Audit logs created for all streak actions

---

### 3. Create Separate "Bonus Settings" Button 🎁
**Status**: Not Started
**Description**: Add a new "Bonus Settings" button next to "🔥 Streaks" in the parent dashboard header

**Requirements**:
- Button placement: Next to "🔥 Streaks" button in parent dashboard header
- Button text: "🎁 Bonuses" or similar
- Opens a new modal with bonus-specific settings
- Should be simpler than Streak Settings (focused on rewards only)

**Bonus Settings Modal Content**:
- Achievement Bonuses (complete X chores, earn Y bonus)
- Birthday Bonuses (automatic bonus on child's birthday)
- Perfect Week Bonus (all chores completed for 7 days)
- Monthly Milestone Bonuses
- Surprise Random Bonuses (lottery system)

**Files to Create/Modify**:
- `web/src/pages/ParentDashboard.tsx` (add button and modal)
- `api/src/controllers/family.ts` (bonus settings endpoints)
- `api/prisma/schema.prisma` (bonus settings fields)
- `worker/src/jobs/bonusProcessor.ts` (new job for bonus calculations)

---

## 🧪 Testing & Verification

### 4. Test Holiday Mode Functionality 🏖️
**Status**: Backend Complete, Testing Pending
**Description**: Verify that holiday mode correctly pauses chores and streaks

**Test Cases**:
- [ ] Family holiday mode blocks all chore generation
- [ ] Child holiday mode blocks chores only for that child
- [ ] Holiday start/end dates work correctly
- [ ] Streaks don't decay during holiday
- [ ] Chores resume after holiday ends
- [ ] UI shows holiday status clearly

---

### 5. End-to-End Testing 🔄
**Status**: Ongoing

#### Payout System
- [ ] Create payout request
- [ ] Parent approval flow
- [ ] Payout history tracking
- [ ] Balance deduction on payout

#### Reward System
- [ ] Browse age-appropriate rewards
- [ ] Filter by gender and category
- [ ] Add to wishlist
- [ ] Redeem with stars
- [ ] Price updates from Amazon API

#### Bidding System (Showdown)
- [ ] Create biddable chore
- [ ] Multiple children bid
- [ ] Winner selection
- [ ] Double star reward
- [ ] Loser consolation handling

#### Leaderboard
- [ ] Weekly score calculation
- [ ] Tie-breaking logic
- [ ] Multi-child family rankings
- [ ] Historical leaderboard data

---

## 🌍 Internationalization & Multi-Currency

### 6. Test Multi-Currency Support 💱
**Status**: Implementation Complete, Testing Pending
**Currencies**: GBP, USD, EUR, RON

**Test Cases**:
- [ ] Currency switching updates all amounts
- [ ] Locale-specific formatting (£1.50 vs $1.50 vs 1,50€)
- [ ] Budget calculations in different currencies
- [ ] Reward prices converted correctly
- [ ] Payout amounts display properly

---

### 7. Test Language Switching 🌐
**Status**: Implementation Complete, Testing Pending
**Languages**: English (EN), Romanian (RO)

**Test Cases**:
- [ ] UI text translates on language switch
- [ ] Chore templates in both languages
- [ ] Email notifications in user's language
- [ ] Date/time formatting per locale
- [ ] Currency symbols match locale

---

## 🚀 Performance & Optimization

### 8. Performance Testing ⚡
**Status**: Not Started

**Areas to Test**:
- [ ] Dashboard load time with 10+ children
- [ ] Chore list with 100+ assignments
- [ ] Leaderboard calculation performance
- [ ] Real-time update latency
- [ ] Database query optimization
- [ ] Redis cache hit rates
- [ ] API response times under load

---

### 9. Security Audit 🔒
**Status**: Not Started

**Security Checklist**:
- [ ] SQL injection prevention (Prisma ORM)
- [ ] XSS protection (input sanitization)
- [ ] CSRF token validation
- [ ] Rate limiting on API endpoints
- [ ] JWT token expiration and refresh
- [ ] Password strength requirements
- [ ] Admin 2FA enforcement
- [ ] Multi-tenant data isolation verification
- [ ] Sensitive data encryption at rest
- [ ] Audit log integrity

---

## 📋 Documentation & Deployment

### 10. Complete Documentation 📚
**Status**: Ongoing

**Documentation Needed**:
- [x] README.md (updated with current features)
- [x] DOCKER_DEVELOPMENT.md (Docker troubleshooting)
- [x] AI_DEVELOPMENT_QUICK_REFERENCE.md (AI assistant guide)
- [ ] API.md (Complete API endpoint documentation)
- [ ] USER_GUIDE.md (End-user manual for parents)
- [ ] CHILD_GUIDE.md (Child-friendly instructions)
- [ ] DEPLOYMENT.md (Production deployment guide)
- [ ] TROUBLESHOOTING.md (Common issues and solutions)

---

### 11. Production Deployment Preparation 🌐
**Status**: Not Started

**Pre-Deployment Checklist**:
- [ ] Environment variables documented
- [ ] Database backup strategy
- [ ] Redis persistence configuration
- [ ] SSL/TLS certificates
- [ ] Domain configuration
- [ ] CDN setup for static assets
- [ ] Logging infrastructure (ELK stack or similar)
- [ ] Monitoring setup (Prometheus/Grafana)
- [ ] Automated backups
- [ ] Disaster recovery plan
- [ ] Load balancer configuration
- [ ] Auto-scaling policies

---

## 🎯 Feature Enhancements (Future)

### 12. Mobile App Development 📱
**Status**: Not Started
**Platform**: React Native (iOS & Android)

### 13. Push Notifications 🔔
**Status**: Not Started
**Use Cases**: Chore reminders, approval notifications, streak warnings

### 14. Family Messaging System 💬
**Status**: Not Started
**Features**: In-app chat, chore comments, parent-child messaging

### 15. Advanced Analytics 📊
**Status**: Not Started
**Features**: Completion trends, earning patterns, time-of-day analytics

---

## ✅ Completed Features

- [x] Basic chore creation and assignment
- [x] Child profile management with themes
- [x] Wallet system (money + stars)
- [x] Chore completion with photo evidence
- [x] Parent approval workflow
- [x] Real-time dashboard updates
- [x] Automated daily/weekly chore generation
- [x] Holiday mode (family and per-child)
- [x] Multi-parent support (parent_admin, parent_viewer, relative_contributor)
- [x] Streak Settings UI (comprehensive, gamified)
- [x] Admin portal with monitoring, security, and email config
- [x] Docker secure stack architecture
- [x] Magic link authentication
- [x] Child join via code
- [x] Multi-currency and multi-language support (framework)
- [x] Birth year tracking for age-appropriate features

---

## 📝 Notes

### Lessons Learned from Tabbed Settings Modal Attempts:
1. **JSX Adjacent Elements**: Always wrap tab content in a SINGLE parent element
2. **Duplicate Keys**: Never have two modals rendering the same children simultaneously
3. **Unicode Preservation**: Be careful with emojis in search/replace operations
4. **Complex Sections**: The Account tab has 3 separate sections - needs careful wrapping
5. **Reference Working Code**: Use Streak Settings Modal as the gold standard template

### Development Best Practices:
- Test builds after each major change
- Commit working states frequently
- Use `git stash` before major refactors
- Check for duplicate state variables
- Verify no console warnings before pushing

---

**Last Updated**: October 28, 2025
**Version**: 1.4.3

