# Streak Rewards Implementation Plan

## Overview
This document outlines the complete implementation plan for the streak rewards system, allowing parents to set up gifts (Amazon products, activities, or custom rewards) that children can redeem with stars earned from completing chores.

## Current System Analysis

### Existing Models
1. **Reward** (family-scoped custom rewards)
   - `type`: `affiliate` | `custom`
   - `starsRequired`: Number of stars needed
   - `ageTag`, `genderTag`, `category`: Filtering
   - `amazonUrl`, `affiliateTag`: For affiliate links
   
2. **RewardItem** (admin-managed affiliate rewards)
   - Global pool of products from Amazon/other providers
   - `ageTag`, `genderTag`, `category` for categorization
   - `starsRequired`: Suggested star cost
   - `featured`, `blocked`: Admin controls

3. **Redemption**
   - Tracks when a child redeems a reward
   - Links to either `Reward` (family custom) or `RewardItem` (affiliate)

4. **Wallet**
   - `stars`: Child's star balance (separate from money)

### Current Shop Flow
- Child Dashboard Shop tab shows `Reward` items (family-scoped custom rewards)
- Children can redeem rewards by spending stars
- Redemption creates a `Redemption` record with status "pending"
- Parent must fulfill the redemption

---

## New Requirements

### 1. Admin Dashboard Features
**Goal**: Create global gift catalog that parents can browse and select from

#### A. Affiliate Product Management
**Current Affiliate Systems:**
- **Amazon Associates**: Standard affiliate links with tracking IDs
- **Amazon SiteStripe**: Unique product URLs that generate affiliate commissions (NOT a payment gateway - it's an affiliate link generation system)
- **Future**: Amazon Product Advertising API (PA-API) for automated product import

**Product Entry Options:**
1. **Manual Entry** (Current)
   - Amazon ASIN
   - Title, description, image (manual entry)
   - Affiliate URL (Amazon Associates or SiteStripe)
   - Price (pence) - manual entry
   - Suggested age ranges (multi-select: 5-8, 9-11, 12-15, etc.)
   - Suggested gender (male, female, both, unisex)
   - Category (toys, books, games, electronics, clothing, etc.)
   - Suggested star cost (auto-calculated from price, but editable)
   - Active/Inactive status

2. **Amazon Wish List Import** (Future - when PA-API available)
   - Import products from Amazon wish lists
   - Auto-populate product details via PA-API
   - Generate affiliate links automatically
   - Bulk import functionality

3. **Other Affiliate Sources** (Future)
   - Support for additional affiliate providers
   - Each provider will have its own URL format and tracking system
   - SiteStripe-style unique URL generation for other providers

#### B. Activity Ideas (Non-Amazon)
- Create activity-based rewards (no cost to parent)
- Examples: "Movie night", "Get a pizza", "Choose dinner", "Stay up 30 minutes late", "Extra screen time", "Baking session with parent"
- Each activity entry:
  - Title
  - Description
  - Suggested age ranges
  - Suggested gender
  - Category (activities, experiences, privileges)
  - Suggested star cost (admin sets default)
  - Icon/emoji for display

#### C. Admin Gift Management
- List all gifts (Amazon + Activities)
- Filter by: provider (Amazon/Activity), age range, gender, category
- Edit/delete gifts
- Set featured status
- Set default star costs
- Bulk actions (activate/deactivate multiple)

---

### 2. Parent Dashboard Features (Mobile-Friendly)
**Goal**: Select and customize gifts for their children, add custom gifts

#### A. Gift Selection Interface
- **Browse Admin Gifts**:
  - View all available admin-created gifts (Amazon + Activities)
  - Filter by age range, category
  - Search by title/description
  - See suggested star costs
  - **Action**: "Add to My Family" button
  
- **My Family Gifts**:
  - List of gifts available to their children
  - Can customize star cost per gift
  - Can enable/disable per child or all children
  - Can remove from family
  
#### B. Custom Gift Creation
- **Add Custom Gift**:
  - Title (required)
  - Description (optional)
  - Type: "Amazon Product" or "Activity" or "Other"
  - If Amazon: URL and optional affiliate tag
  - If Activity: Description of activity
  - Image upload (optional, for custom gifts)
  - Star cost (required)
  - Age suggestion (optional)
  - Gender suggestion (optional)
  - Category (optional)
  - **Per-child assignment**: Can assign to specific children or all
  
#### C. Gift Management
- View all family gifts (admin + custom)
- Filter by: source (Admin/My Custom), type (Amazon/Activity/Other), assigned children
- Edit custom gifts (star cost, description, assignment)
- Delete custom gifts
- Set gift availability per child

---

### 3. Child Dashboard Features
**Goal**: Browse and redeem gifts in Shop tab

#### A. Shop Display
- Show all available gifts for the logged-in child
- Filter by: All, Amazon Products, Activities, My Stars Only
- Sort by: Star Cost (low to high, high to low), Newest
- Display:
  - Gift image/icon
  - Title
  - Description
  - Star cost
  - "Redeem" button (disabled if insufficient stars)
  - Badge if featured/admin-recommended

#### B. Gift Details Modal
- Full gift information
- Larger image
- Star cost display
- "Redeem" button
- Shows remaining stars after redemption

#### C. Redemption Flow
- Child clicks "Redeem"
- Confirmation modal: "Spend X stars on [Gift Name]?"
- On confirm:
  - Deduct stars from wallet
  - Create Redemption record (status: "pending")
  - Show success message
  - Update wallet balance in UI
  - Remove gift from available list (or show as "Redeemed - Pending")

---

## Database Schema Changes

### Note on Existing RewardProvider Enum
The current schema has a `RewardProvider` enum that includes `amazon`, `ebay`, `argos`, `ticketmaster`, `custom`. For the new streak rewards system, we'll need to:
1. Extend the enum to distinguish between Amazon Associates and SiteStripe
2. Or use a string field with values: `"amazon_associates"`, `"amazon_sitestripe"`, `"amazon_paapi"` (future)
3. Design for extensibility to add other affiliate providers later

### New Models

```prisma
// Global gift catalog (admin-managed)
model GiftTemplate {
  id              String   @id @default(uuid())
  
  // Gift type
  type            GiftType // "amazon_product" | "activity" | "custom"
  
  // Affiliate product fields
  // Note: provider field distinguishes between affiliate systems:
  // - "amazon_associates": Standard affiliate links with tracking IDs
  // - "amazon_sitestripe": SiteStripe unique product URLs (NOT a payment gateway)
  // - "amazon_paapi": Future - automated via PA-API
  // - Future: Other affiliate providers (ebay, argos, etc.)
  provider        String?  // "amazon_associates" | "amazon_sitestripe" | "future_provider"
  amazonAsin      String?  // For Amazon products
  affiliateUrl    String?  // Full affiliate link (Amazon Associates, SiteStripe, or other)
  affiliateTag    String?  // Tracking ID for Amazon Associates
  sitestripeUrl   String?  // SiteStripe unique product URL (if using SiteStripe)
  
  // Common fields
  title           String
  description     String?  @db.Text
  imageUrl        String?
  category        String?  // "toys", "books", "activities", "experiences", etc.
  
  // Age/Gender suggestions
  suggestedAgeRanges String[] // ["5-8", "9-11", "12-15"]
  suggestedGender    String?  // "male" | "female" | "both" | "unisex"
  
  // Pricing
  pricePence      Int?     // For Amazon products
  suggestedStars  Int      // Default star cost
  
  // Admin controls
  active          Boolean  @default(true)
  featured        Boolean  @default(false)
  createdBy       String?  // Admin user ID
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  // Relations
  familyGifts     FamilyGift[]
  
  @@index([type, active])
  @@index([category, active])
}

enum GiftType {
  amazon_product
  activity
  custom
}

// Family-specific gift selection (parent creates this from templates or custom)
model FamilyGift {
  id              String   @id @default(uuid())
  familyId        String
  
  // Source tracking
  giftTemplateId  String?  // If created from admin template
  isCustom        Boolean  @default(false) // If parent created custom
  
  // Gift details (copied from template or custom)
  type            GiftType
  title           String
  description     String?  @db.Text
  imageUrl        String?
  
  // Affiliate fields (if type = amazon_product)
  provider        String?  // "amazon_associates" | "amazon_sitestripe" | "future_provider"
  amazonAsin      String?
  affiliateUrl    String?  // Full affiliate link
  affiliateTag    String?  // Amazon Associates tracking ID
  sitestripeUrl   String?  // SiteStripe unique URL
  
  category        String?
  
  // Star cost (parent can customize)
  starsRequired   Int
  
  // Age/Gender (for filtering)
  ageTag          String?
  genderTag       String?
  
  // Per-child availability
  availableForAll Boolean  @default(true)
  availableForChildIds String[] // Array of child IDs if not all
  
  // Active status
  active          Boolean  @default(true)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  // Relations
  family          Family   @relation(fields: [familyId], references: [id])
  giftTemplate    GiftTemplate? @relation(fields: [giftTemplateId], references: [id])
  redemptions     Redemption[]
  
  @@index([familyId, active])
  @@index([familyId, type])
}

// Update Redemption model to reference FamilyGift
model Redemption {
  // ... existing fields ...
  
  // Change from Reward to FamilyGift
  familyGiftId    String?  // References FamilyGift instead of Reward
  rewardId        String?  // Keep for backward compatibility (deprecated)
  
  // ... rest of fields ...
  
  familyGift      FamilyGift? @relation(fields: [familyGiftId], references: [id])
}
```

### Migration Strategy
1. Keep existing `Reward` model for backward compatibility
2. Create new `GiftTemplate` and `FamilyGift` models
3. Update `Redemption` to support both old and new models
4. Migrate existing rewards to new system (optional, later)

---

## API Endpoints

### Admin API (Admin Dashboard)

#### Gift Template Management
- `GET /admin/gift-templates` - List all gift templates
- `POST /admin/gift-templates` - Create new gift template
- `GET /admin/gift-templates/:id` - Get template details
- `PATCH /admin/gift-templates/:id` - Update template
- `DELETE /admin/gift-templates/:id` - Delete template
- `POST /admin/gift-templates` - Create new gift template (manual entry)
- `POST /admin/gift-templates/import-amazon` - Import from Amazon list/ASIN (Future - when PA-API available)
- `POST /admin/gift-templates/generate-affiliate-url` - Generate affiliate URL from ASIN + tag
- `POST /admin/gift-templates/bulk-activate` - Bulk activate/deactivate

### User API (Parent & Child Dashboard)

#### Family Gift Management
- `GET /family/gifts` - List all family gifts (admin + custom)
  - Query params: `childId?`, `type?`, `category?`
- `POST /family/gifts` - Create custom family gift
- `POST /family/gifts/:templateId/add` - Add admin template to family
- `GET /family/gifts/:id` - Get gift details
- `PATCH /family/gifts/:id` - Update family gift (star cost, assignment)
- `DELETE /family/gifts/:id` - Remove gift from family
- `GET /gift-templates` - Browse available admin templates (read-only)

#### Redemption (Child)
- `GET /redemptions` - List child's redemptions (existing, may need updates)
- `POST /redemptions` - Create redemption (update to use FamilyGift)
- `PATCH /redemptions/:id/fulfill` - Parent fulfills redemption (existing)

---

## UI/UX Flow

### Admin Dashboard Flow

1. **Gift Templates Section**
   ```
   Admin Dashboard → Gift Templates Tab
   ├── List View (table/cards)
   │   ├── Filter: Type, Category, Age Range, Active Status
   │   ├── Search: Title/Description
   │   └── Actions: Add New, Bulk Actions
   ├── Add/Edit Form
   │   ├── Type Selector (Amazon/Activity)
   │   ├── Amazon Fields (if type = amazon_product)
   │   │   ├── ASIN input
   │   │   ├── Import from Amazon button
   │   │   └── Auto-fill from PA-API
   │   ├── Activity Fields (if type = activity)
   │   │   ├── Title, Description
   │   │   └── Icon/Emoji selector
   │   ├── Common Fields
   │   │   ├── Title, Description
   │   │   ├── Image upload
   │   │   ├── Category dropdown
   │   │   ├── Age ranges (multi-select checkboxes)
   │   │   ├── Gender (radio: male/female/both/unisex)
   │   │   └── Suggested stars (number input)
   │   └── Save button
   └── Detail View (for editing)
   ```

2. **Affiliate Product Import** (Current & Future)
   ```
   Gift Templates → Add Affiliate Product
   ├── Current: Manual Entry
   │   ├── Provider selector: "Amazon Associates" | "Amazon SiteStripe"
   │   ├── If Amazon Associates:
   │   │   ├── ASIN input
   │   │   ├── Affiliate tracking ID input
   │   │   └── Generate affiliate URL
   │   ├── If Amazon SiteStripe:
   │   │   ├── SiteStripe URL input (unique product URL)
   │   │   └── Auto-extract product details if possible
   │   ├── Manual entry: Title, Description, Image URL, Price
   │   └── Age/Gender/Category/Star cost configuration
   │
   └── Future: Amazon Wish List Import (when PA-API available)
       ├── Input: Amazon Wish List URL or ASIN list
       ├── Fetch products via PA-API
       ├── Show import preview
       │   ├── Product cards with checkboxes
       │   ├── Auto-fill product details
       │   ├── Generate affiliate links (Associates or SiteStripe)
       │   ├── Auto-fill suggested ages/stars
       │   └── Edit before import
       └── Bulk import selected products
   ```

### Parent Dashboard Flow (Mobile-First)

1. **Gifts Section**
   ```
   Parent Dashboard → Gifts Tab (new section)
   ├── Tabs: "My Family Gifts" | "Browse Admin Gifts"
   │
   ├── "My Family Gifts" Tab
   │   ├── List of family gifts (cards)
   │   │   ├── Gift image/icon
   │   │   ├── Title, description
   │   │   ├── Star cost (editable inline)
   │   │   ├── Assigned to: [child names or "All"]
   │   │   ├── Source badge: "Admin" or "My Custom"
   │   │   └── Actions: Edit, Remove, Enable/Disable
   │   ├── "Add Custom Gift" button (floating/fixed bottom)
   │   └── Filter: All, By Child, By Type
   │
   ├── "Browse Admin Gifts" Tab
   │   ├── Search bar (top)
   │   ├── Filter chips
   │   │   ├── Age: 5-8, 9-11, 12-15
   │   │   ├── Category: Toys, Books, Activities, etc.
   │   │   └── Type: Amazon, Activities
   │   ├── Gift grid (cards)
   │   │   ├── Gift image
   │   │   ├── Title
   │   │   ├── Suggested stars
   │   │   ├── Age range badges
   │   │   └── "Add to My Family" button
   │   └── Infinite scroll or pagination
   │
   └── "Add Custom Gift" Modal
       ├── Form (mobile-optimized)
       ├── Type selector (Affiliate Product/Activity/Other)
       ├── If Affiliate Product:
       │   ├── Provider selector (Amazon Associates/SiteStripe/Other)
       │   ├── Affiliate URL input
       │   ├── Product details (title, description, image, price)
       │   └── Category/Age/Gender
       ├── If Activity:
       │   ├── Title, Description
       │   └── Icon/Emoji selector
       ├── Star cost input (required)
       ├── "Assign to" selector (All children or specific)
       └── Save button
   ```

2. **Gift Detail/Edit Modal**
   ```
   Click on gift → Edit Modal
   ├── Gift preview (image, title, description)
   ├── Star cost input (editable)
   ├── "Available for" section
   │   ├── Toggle: "All children" or "Specific children"
   │   └── Child checkboxes (if specific)
   ├── Active/Inactive toggle
   └── Save/Cancel buttons
   ```

### Child Dashboard Flow

1. **Shop Tab Enhancement**
   ```
   Child Dashboard → Shop Tab (existing, enhanced)
   ├── Header
   │   ├── Current stars display (large, prominent)
   │   └── Filter/Sort dropdown
   ├── Gift Grid (cards)
   │   ├── Gift image/icon
   │   ├── Title
   │   ├── Star cost (with "You have X stars" indicator)
   │   ├── "Redeem" button
   │   │   ├── Enabled if child has enough stars
   │   │   └── Disabled with "Need X more stars" if insufficient
   │   └── Badge: "Featured" or "New" (if applicable)
   ├── Gift Detail Modal (on click)
   │   ├── Large image
   │   ├── Full description
   │   ├── Star cost (large)
   │   ├── Your stars: X (with remaining after: X)
   │   └── "Redeem Now" button
   └── Redemption Confirmation Modal
       ├── "Confirm Redemption" header
       ├── Gift preview
       ├── "Spend X stars?" confirmation
       ├── Stars before → Stars after
       └── "Confirm" / "Cancel" buttons
   ```

2. **Redemption Status**
   ```
   After redemption → Success message
   ├── "You redeemed [Gift Name]!"
   ├── New star balance
   ├── Status: "Pending parent approval"
   └── View in "My Redemptions" link
   ```

---

## Mobile Responsiveness Considerations

### Parent Dashboard (Mobile)
- **Gift Cards**: Stack vertically on mobile, 2 columns on tablet, 3+ on desktop
- **Filters**: Collapsible drawer or bottom sheet on mobile
- **Add Gift Button**: Fixed bottom button (FAB) on mobile, regular button on desktop
- **Form Modals**: Full-screen on mobile, centered modal on desktop
- **Touch Targets**: Minimum 44x44px for all interactive elements
- **Swipe Gestures**: Swipe to delete/edit on gift cards (optional)

### Child Dashboard (Mobile)
- **Shop Grid**: 1 column on mobile, 2 on tablet, 3+ on desktop
- **Star Balance**: Large, fixed at top of shop tab
- **Gift Cards**: Touch-friendly, large images
- **Redeem Button**: Prominent, full-width on mobile cards

---

## Implementation Phases

### Phase 1: Database & API Foundation
1. Create `GiftTemplate` model
2. Create `FamilyGift` model
3. Update `Redemption` model
4. Create migrations
5. Create admin API endpoints (CRUD for templates)
6. Create user API endpoints (family gifts, templates browse)

### Phase 2: Admin Dashboard
1. Gift Templates list page
2. Create/Edit template form
3. Amazon import functionality
4. Activity creation form
5. Gift template management (bulk actions, filters)

### Phase 3: Parent Dashboard
1. Gifts section (new tab/section)
2. "My Family Gifts" list
3. "Browse Admin Gifts" with filters
4. Add custom gift form
5. Gift assignment per child
6. Star cost customization

### Phase 4: Child Dashboard
1. Enhanced Shop tab
2. Gift display (from FamilyGift)
3. Redemption flow
4. Redemption confirmation
5. Redemption status display

### Phase 5: Polish & Testing
1. Mobile responsiveness
2. Loading states
3. Error handling
4. User testing
5. Performance optimization

---

## Data Flow Examples

### Example 1: Admin Creates Affiliate Product Gift (Current - Manual)
```
Admin Dashboard
  → Create Gift Template
    → Type: "amazon_product"
    → Provider: "Amazon Associates" or "Amazon SiteStripe"
    → If Amazon Associates:
      → ASIN: "B08XYZ123"
      → Affiliate Tag: "mytag-20"
      → Generate: "https://amazon.co.uk/dp/B08XYZ123?tag=mytag-20"
    → If SiteStripe:
      → SiteStripe URL: "https://sitestripe.amazon.com/..."
    → Title: "LEGO Classic Set" (manual entry)
    → Description: "..." (manual entry)
    → Image URL: "..." (manual entry or Amazon product image)
    → Price: 2999 pence (£29.99)
    → Suggested Age: [5-8, 9-11]
    → Suggested Stars: 300
  → Save
    → Creates GiftTemplate record
```

### Example 1b: Admin Creates Activity Gift
```
Admin Dashboard
  → Create Gift Template
    → Type: "activity"
    → Title: "Movie Night"
    → Description: "Choose a movie and watch together"
    → Suggested Age: [9-11, 12-15]
    → Suggested Stars: 50
  → Save
    → Creates GiftTemplate record
```

### Example 2: Parent Adds Admin Gift to Family
```
Parent Dashboard
  → Browse Admin Gifts
    → Filter: Activities, Age 9-11
    → Select "Movie Night"
  → Click "Add to My Family"
    → Modal: Set star cost (default: 50, editable)
    → Select children: "Ellie" or "All"
  → Save
    → Creates FamilyGift record
      - giftTemplateId: [template ID]
      - starsRequired: 50 (or custom)
      - availableForChildIds: [Ellie's ID] or []
      - familyId: [parent's family]
```

### Example 3: Child Redeems Gift
```
Child Dashboard
  → Shop Tab
    → See "Movie Night" (50 stars)
    → Click "Redeem"
  → Confirmation Modal
    → "Spend 50 stars on Movie Night?"
    → Current: 75 stars, After: 25 stars
  → Confirm
    → API: POST /redemptions
      - Deducts 50 stars from wallet
      - Creates Redemption (status: "pending")
    → Success message
    → Wallet updates to 25 stars
    → Gift shows as "Redeemed - Pending"
```

### Example 4: Parent Fulfills Redemption
```
Parent Dashboard
  → Pending Approvals section (existing)
    → See "Ellie redeemed Movie Night"
  → Click "Fulfill"
    → Mark redemption as "fulfilled"
    → (Optional) Send notification to child
```

---

## Affiliate System Architecture

### Current Affiliate Systems

1. **Amazon Associates**
   - Standard affiliate program
   - Uses tracking IDs (affiliate tags) in URLs
   - Format: `https://amazon.co.uk/dp/ASIN?tag=tracking-id`
   - Manual entry required

2. **Amazon SiteStripe**
   - **IMPORTANT**: SiteStripe is NOT a payment gateway
   - It's an affiliate link generation system
   - Provides unique product URLs that generate affiliate commissions
   - Used for creating affiliate links without direct ASIN access
   - Format: Unique SiteStripe URLs per product

### Future Affiliate Systems

3. **Amazon Product Advertising API (PA-API)**
   - Automated product data import
   - Bulk import from wish lists
   - Auto-populate product details (title, description, images, prices)
   - Generate affiliate links automatically
   - Requires API credentials setup

4. **Other Affiliate Providers** (Future)
   - System designed to be extensible
   - Each provider will have its own URL format
   - Provider-specific tracking systems
   - Can add new providers without major schema changes

### Implementation Notes

- **Current**: Manual entry for affiliate products (Associates or SiteStripe)
- **Database**: Store provider type, affiliate URLs, and tracking information
- **Future**: PA-API integration will auto-populate product data
- **Extensibility**: Design models and APIs to support multiple providers

## Key Design Decisions

1. **Two-Tier System**: Admin templates (global) + Family gifts (parent-selected/custom)
   - Allows admin to curate quality gifts
   - Parents can customize star costs and assignments
   - Parents can add custom gifts for their children

2. **Star Cost Flexibility**: Parents can override suggested star costs
   - Allows parents to adjust based on their budget/preferences
   - Different children can have different star costs for same gift (if needed)

3. **Per-Child Assignment**: Gifts can be assigned to specific children
   - Useful for age-specific gifts
   - Allows personalized gift selection per child

4. **Backward Compatibility**: Keep existing Reward model
   - Existing rewards continue to work
   - Gradual migration path
   - No breaking changes

5. **Activity Gifts**: No-cost experiences for parents
   - Encourages parent-child bonding
   - No monetary cost to parents
   - High perceived value for children

---

## Open Questions / Decisions Needed

1. **Star Cost Calculation**: 
   - Auto-calculate from price? (e.g., £10 = 100 stars?)
   - Or admin sets manually?
   - **Recommendation**: Admin sets suggested, parent can override

2. **Gift Availability**:
   - Can child redeem same gift multiple times?
   - Or one-time only?
   - **Recommendation**: Allow multiple redemptions (parent controls via gift availability)

3. **Redemption Fulfillment**:
   - Automatic for activities?
   - Manual approval for Amazon products?
   - **Recommendation**: All require parent fulfillment (for consistency)

4. **Affiliate Product Import**:
   - **Current**: Manual entry with Amazon Associates or SiteStripe URLs
   - **Future**: Amazon PA-API for automated wish list/ASIN import
   - **Future**: Support for other affiliate providers
   - **Recommendation**: 
     - Start with manual entry (current)
     - Add PA-API bulk import when available
     - Design system to support multiple affiliate providers

5. **Image Handling**:
   - Store images locally or use affiliate provider URLs?
   - **Recommendation**: 
     - Use affiliate provider image URLs (Amazon, etc.)
     - Cache images locally for performance
     - Allow custom image uploads for activities/custom gifts
     - Fallback to placeholder if image unavailable

6. **Affiliate System Architecture**:
   - **Current**: Amazon Associates (affiliate links with tracking IDs)
   - **Current**: SiteStripe (unique product URLs - NOT a payment gateway, it's an affiliate link system)
   - **Future**: Amazon PA-API (automated product data import)
   - **Future**: Other affiliate providers (design extensible system)
   - **Important**: SiteStripe is an affiliate link generation system, not a payment processing gateway

---

## Next Steps

1. **Review this plan** with stakeholders
2. **Confirm design decisions** on open questions
3. **Create detailed wireframes** for UI flows
4. **Start Phase 1** implementation (database & API)

