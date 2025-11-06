# Deployment Readiness TODO List

**Last Updated:** November 2025  
**Version:** 0.1.10

This document tracks all tasks required to make ChoreBlimey production-ready.

---

## 🔴 CRITICAL - Must Fix Before Production

### Security
- [ ] **SEC-001:** Enable Helmet.js security headers (partially done - need to verify)
  - [x] Helmet.js configured with security headers
  - [ ] Verify headers are being sent in responses
  - [ ] Test in production-like environment
  
- [ ] **SEC-002:** Create nginx configuration for main web app
  - [ ] Create `infra/docker/web.nginx.conf`
  - [ ] Add security headers (X-Content-Type-Options, X-Frame-Options, etc.)
  - [ ] Configure CSP headers
  - [ ] Add cache-control headers for static assets
  - [ ] Configure Gzip compression
  
- [ ] **SEC-003:** Restrict CORS to specific origins
  - [ ] Add `ALLOWED_ORIGINS` environment variable
  - [ ] Update API CORS configuration
  - [ ] Update Admin API CORS configuration
  - [ ] Document allowed origins in deployment guide
  
- [ ] **SEC-004:** Configure HTTPS/SSL
  - [ ] Obtain SSL certificates
  - [ ] Configure nginx with SSL
  - [ ] Enable HSTS headers
  - [ ] Set up certificate auto-renewal
  
- [ ] **SEC-005:** Implement secrets management
  - [ ] Set up AWS Secrets Manager (or equivalent)
  - [ ] Move JWT_SECRET to secrets manager
  - [ ] Move database credentials to secrets manager
  - [ ] Move SMTP credentials to secrets manager
  - [ ] Update deployment scripts to fetch secrets

### Performance & Real-Time Updates
- [ ] **PERF-001:** Implement WebSockets or Server-Sent Events
  - [ ] Evaluate WebSockets vs SSE
  - [ ] Implement chosen solution
  - [ ] Replace polling with real-time push
  - [ ] Test cross-tab real-time updates
  
- [ ] **PERF-002:** Optimize polling (temporary solution)
  - [ ] Add Page Visibility API checks (only poll when visible)
  - [ ] Implement exponential backoff
  - [ ] Consolidate polling intervals
  - [ ] Add debouncing to prevent rapid-fire calls
  
- [ ] **PERF-003:** Fix real-time update delays
  - [ ] Ensure redemption approval triggers immediate child dashboard update
  - [ ] Ensure completion approval triggers immediate child dashboard update
  - [ ] Test cross-tab communication
  - [ ] Add fallback mechanisms

---

## 🟡 HIGH PRIORITY - Should Fix Soon

### Security
- [ ] **SEC-006:** Implement token refresh mechanism
  - [ ] Design refresh token flow
  - [ ] Implement refresh token endpoint
  - [ ] Update frontend to handle token refresh
  - [ ] Add token expiration warnings
  
- [ ] **SEC-007:** Add input sanitization
  - [ ] Add DOMPurify or similar for XSS prevention
  - [ ] Sanitize user inputs before storing
  - [ ] Add validation for file uploads
  - [ ] Test against XSS attack vectors
  
- [ ] **SEC-008:** Implement rate limiting per user/IP
  - [ ] Add user-specific rate limiting
  - [ ] Add IP-based rate limiting
  - [ ] Configure limits for different endpoints
  - [ ] Add rate limit headers to responses

### Performance
- [ ] **PERF-004:** Optimize database queries
  - [ ] Review slow queries
  - [ ] Add missing indexes
  - [ ] Optimize N+1 queries
  - [ ] Add query result caching
  
- [ ] **PERF-005:** Implement caching strategy
  - [ ] Cache frequently accessed data
  - [ ] Implement cache invalidation
  - [ ] Add cache headers to API responses
  - [ ] Configure CDN caching
  
- [ ] **PERF-006:** Optimize bundle size
  - [ ] Analyze bundle size
  - [ ] Remove unused dependencies
  - [ ] Implement code splitting
  - [ ] Enable tree shaking
  
- [ ] **PERF-007:** Image optimization
  - [ ] Implement image compression
  - [ ] Add responsive image sizes
  - [ ] Use WebP format where supported
  - [ ] Lazy load images

### Code Quality
- [ ] **CODE-001:** Extract shared real-time update utilities
  - [ ] Create `hooks/useRealtimeUpdates.ts`
  - [ ] Create `utils/notifications.ts`
  - [ ] Refactor ParentDashboard to use shared utilities
  - [ ] Refactor ChildDashboard to use shared utilities
  
- [ ] **CODE-002:** Improve in-code documentation
  - [ ] Add JSDoc comments to all functions
  - [ ] Document complex logic
  - [ ] Add type definitions where missing
  - [ ] Document API endpoints
  
- [ ] **CODE-003:** Create API documentation
  - [ ] Use OpenAPI/Swagger
  - [ ] Document all endpoints
  - [ ] Add request/response examples
  - [ ] Generate interactive API docs
  
- [ ] **CODE-004:** Refactor duplicated code
  - [ ] Identify all duplicated code
  - [ ] Extract shared components
  - [ ] Extract shared utilities
  - [ ] Update tests

---

## 🟢 MEDIUM PRIORITY - Nice to Have

### Infrastructure
- [ ] **INFRA-001:** Set up monitoring and alerting
  - [ ] Set up error tracking (Sentry)
  - [ ] Set up performance monitoring
  - [ ] Configure uptime monitoring
  - [ ] Set up alerts for critical errors
  
- [ ] **INFRA-002:** Configure logging
  - [ ] Set up structured logging
  - [ ] Configure log aggregation
  - [ ] Add log rotation
  - [ ] Set up log retention policies
  
- [ ] **INFRA-003:** Set up database backups
  - [ ] Configure automated backups
  - [ ] Test backup restoration
  - [ ] Set up backup retention
  - [ ] Document recovery procedures
  
- [ ] **INFRA-004:** Configure CDN
  - [ ] Set up Cloudflare (or equivalent)
  - [ ] Configure caching rules
  - [ ] Enable DDoS protection
  - [ ] Configure SSL/TLS

### Security
- [ ] **SEC-009:** Implement client-side encryption for PII
  - [ ] Design encryption scheme
  - [ ] Implement encryption for realNameCipher
  - [ ] Implement encryption for dobCipher
  - [ ] Test encryption/decryption
  
- [ ] **SEC-010:** Add audit logging
  - [ ] Log sensitive operations
  - [ ] Log authentication events
  - [ ] Log data access
  - [ ] Store audit logs securely
  
- [ ] **SEC-011:** Security scanning
  - [ ] Set up dependency scanning (npm audit, Snyk)
  - [ ] Set up code scanning (SonarQube, etc.)
  - [ ] Configure automated security scans
  - [ ] Fix identified vulnerabilities

### Compliance
- [ ] **COMP-001:** GDPR compliance
  - [ ] Review data processing practices
  - [ ] Implement data export functionality
  - [ ] Implement data deletion functionality
  - [ ] Update privacy policy
  
- [ ] **COMP-002:** Cookie consent
  - [ ] Implement cookie consent banner
  - [ ] Configure cookie categories
  - [ ] Add cookie preferences
  - [ ] Test consent flow

---

## 📋 Browser Console Issues Fixed

### ✅ Fixed
- [x] CSP violations for Google Fonts
- [x] CSS compatibility (`-webkit-text-size-adjust`)
- [x] Accessibility (missing `aria-label` on switch button)

### ⚠️ Remaining (Requires Infrastructure)
- [ ] MIME type (`text/javascript` → `application/javascript`) - Requires nginx/Vite config
- [ ] Cache-control headers for Google Fonts - Requires nginx/CDN
- [ ] X-Content-Type-Options header - Requires nginx (partially done in Helmet)

---

## 🎯 Quick Wins (Can Do Immediately)

1. **Add Page Visibility API to polling** - 30 minutes
2. **Extract shared notification utilities** - 1-2 hours
3. **Add exponential backoff to polling** - 1 hour
4. **Improve JSDoc comments** - Ongoing
5. **Create nginx config for web app** - 1-2 hours

---

## 📊 Progress Tracking

**Critical Issues:** 0/8 complete (0%)  
**High Priority:** 0/12 complete (0%)  
**Medium Priority:** 0/11 complete (0%)  
**Browser Issues:** 3/6 fixed (50%)

**Overall Progress:** 3/37 complete (8%)

---

## 🚀 Deployment Checklist

Before deploying to production, ensure:

### Pre-Deployment
- [ ] All critical security issues resolved
- [ ] Security headers configured
- [ ] HTTPS/SSL certificates obtained
- [ ] Secrets management configured
- [ ] Database backups automated
- [ ] Monitoring and alerting set up

### Deployment
- [ ] Deploy to staging environment
- [ ] Run full test suite
- [ ] Perform security scan
- [ ] Load testing completed
- [ ] Rollback plan prepared

### Post-Deployment
- [ ] Verify all services running
- [ ] Check error logs
- [ ] Monitor performance metrics
- [ ] Verify security headers
- [ ] Test critical user flows

---

**Next Review:** After completing Phase 1 (Critical Security)





