# Changelog

All notable changes to ChoreBlimey! will be documented in this file.

## [0.1.4] - 2025-11-25

### Fixed
- **Budget Settings Console Errors**
  - Removed console warnings for duplicate assignments in budget calculation
  - Removed debug console logs from budget earnings calculation
  - Clean console output when opening settings/budget modal

- **Single-Child Gift Purchase Handling**
  - Fixed "All Children" checkbox auto-unchecking when single child purchases non-recurring gift
  - Improved gift re-listing workflow for single-child families
  - Enhanced gift edit modal to handle purchased non-recurring gifts correctly

### Changed
- **Gift Visibility Control**
  - Improved handling of non-recurring gifts after redemption
  - Better UI feedback for purchased gifts in parent dashboard

## [0.1.3] - 2025-11-25

### Changed
- **Gift Visibility Control**
  - Removed automatic filtering of non-recurring gifts after redemption
  - Parents now have full control over gift visibility via `availableForChildIds`
  - Non-recurring gifts remain visible in parent dashboard until manually removed from child's list
  - Parents can choose to offer gifts again by re-adding them to a child's available gifts

### Added
- **Purchased Badge on Parent Dashboard**
  - Added green "✓ Purchased" badge on gift cards that have been redeemed
  - Shows on both pending and fulfilled redemptions
  - Helps parents quickly identify which gifts have been purchased

- **Redemption Analytics in Admin Dashboard**
  - Added redemption count tracking for gift templates
  - Shows total number of times each template has been redeemed across all families
  - Displayed as "X purchases" in the gift templates table
  - Helps identify which gifts are popular and working well

### Fixed
- Optimized admin API redemption count queries to use single batch query instead of per-template queries

## [0.1.2] - 2025-11-24

### Added
- **Gift Redemption Workflow**
  - Full redemption approval workflow on parent dashboard
  - Children can see pending redemptions and order history
  - Real-time updates when redemptions are approved/rejected
  - Star refunds when redemptions are rejected
  - Amazon affiliate links for easy parent purchasing

### Fixed
- Removed price display from child dashboard (children only see star costs)
- Added real-time refresh for redemption status updates
- Fixed redemption history to show Amazon links for approved products

## [0.1.1] - 2025-11-23

### Added
- **Recurring Gifts Feature**
  - Added `recurring` field to GiftTemplate and FamilyGift models
  - Recurring gifts can be purchased multiple times (e.g., activity gifts like "Movie Night")
  - Non-recurring gifts are hidden from child shop after first redemption
  - Admin can set recurring status when creating/editing gift templates
  - Parent can toggle recurring status when adding/editing family gifts
  - Quick recurring toggle checkbox in admin gift templates list for easy management

### Fixed
- **Gift Creation User Attribution**
  - Fixed bug where "Added by" information was not showing for gifts added via "Browse Gifts"
  - Fixed `createdBy` field to properly use `sub` from JWT claims instead of `userId`
  - Added `createdByUser` relation to gift creation responses
  - Now correctly displays who added each gift to the family

- **Admin Dashboard Logout Error**
  - Fixed `FST_ERR_CTP_EMPTY_JSON_BODY` error when logging out from admin dashboard
  - Improved response handling to gracefully handle empty/non-JSON responses
  - Logout now works even with expired/invalid tokens

### Changed
- Improved error handling in admin API client for empty response bodies
- Enhanced gift creation endpoints to include user information in responses

## [Unreleased] - 2025-10-28

### Fixed
- **Duplicate Assignments Issue**
  - Fixed duplicate assignments appearing on child dashboard for uncompleted tasks
  - Worker now properly checks for existing assignments before creating new ones
  - Child dashboard filters to show only today's assignments for daily chores
  - Weekly chores filtered to show only current week's assignments
  - Prevents duplicate assignments when worker runs multiple times
  
- **React Key Warnings**
  - Fixed duplicate React key warnings for children in parent dashboard
  - Added defensive de-duplication logic before rendering children arrays
  - Fixed duplicate children in assignedChildren array from chore assignments
  - Improved component rendering stability

- **JSX Compilation Errors**
  - Fixed "Adjacent JSX elements" error in Settings modal
  - Corrected tabbed Settings modal structure (Rivalry, Budget, Account)
  - Removed duplicate sections in Account tab
  - Improved modal component organization

### Added
- **Admin Dashboard Improvements**
  - Real-time system statistics (families, children, chores, completions)
  - Live system health monitoring with actual database queries
  - Recent activity feed pulling from audit logs instead of mock data
  
- **Email Configuration**
  - Three email modes: MailHog Only, Real SMTP Only, Both (for testing)
  - Easy switching between development and production email setups
  - Detailed descriptions for each mode
  
- **System Monitoring Page**
  - Live system metrics (uptime, memory usage, CPU)
  - Service health dashboard (Database, Redis, Email)
  - Real-time stats with auto-refresh every 30 seconds
  - Memory usage breakdown (heap, RSS, external)
  
- **Security Management Page**
  - Security logs (login attempts, authentication events)
  - Complete audit logs (all admin actions and system events)
  - Active sessions management with revoke capability
  - Tabbed interface for easy navigation
  
- **Account Cleanup Improvements**
  - Real database statistics for cleanup metrics
  - Audit log integration for cleanup history
  - Manual cleanup trigger functionality
  - Detailed inactive family tracking

### Fixed
- **Magic Link Authentication**
  - Fixed TokenHandler to prevent multiple token processing
  - Added processing ref to stop React re-renders from consuming tokens
  - Improved error handling with user-friendly error pages
  - Database schema sync issue resolved (holiday mode columns)
  
- **Admin API**
  - Replaced mock Prisma client with real database connection
  - Fixed Prisma schema field names (metaJson, target vs metadata, details)
  - Proper authentication bypass for monitoring and cleanup endpoints during development
  - Fixed Docker volume issues causing stale Prisma client
  
- **Parent Dashboard**
  - Fixed child join code polling to check correct array (children vs members)
  - Improved refresh logic when children join via join codes

### Changed
- Admin dashboard now displays real data from the database
- System logs section renamed to "System Status" for clarity
- Admin API controllers updated to use correct Prisma field names
- Docker setup improved to prevent Prisma client sync issues

### Infrastructure
- Added holiday mode migration to database schema
- Improved Docker Compose configuration for admin services
- Enhanced admin API Dockerfile with proper Prisma generation
- Removed unnecessary volume mounts that caused stale dependencies

## [Previous Versions]

See git history for earlier changes.
