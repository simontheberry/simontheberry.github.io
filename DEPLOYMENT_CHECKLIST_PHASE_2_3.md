# Deployment & Release Checklist - Phase 2 & 3

**Target Deploy Date:** Monday, March 3, 2026 (after Phase 3 completion Friday)
**Target Go-Live Date:** Tuesday, March 4, 2026 (one day for smoke testing)
**Scope:** All Phase 2 (8 tasks) + Phase 3 (4 streams) = 12 feature sets + optimizations

---

## Executive Summary

After Friday's Phase 3 completion, we'll deploy **ALL Phase 2 and Phase 3 work to production**. This includes:
- ✅ 8 core platform features (Phase 2)
- ✅ Database performance optimizations (Phase 3)
- ✅ Test coverage expansion (Phase 3)
- ✅ AI infrastructure hardening (Phase 3)
- ✅ Security hardening (Phase 3)

**Total Platform Readiness:** 100% (from 87.5% at Phase 2 start)

---

## Pre-Deployment Verification (Friday EOD → Monday AM)

### Code Quality Gate

**All Code Must Pass:**
```bash
npm run typecheck    # 0 errors required (strict mode)
npm run lint         # 0 warnings required
npm run test         # 100% tests passing required
npm run build        # Frontend + server build successful
```

**Status Check:**
- [ ] TypeScript: 0 errors (all files)
- [ ] Lint: 0 warnings (all files)
- [ ] Tests: 100% passing (156+ tests)
- [ ] Build: Successful (no build errors)
- [ ] Bundle Size: Check for any regressions

### Database Verification

**Migrations Ready:**
```bash
npx prisma migrate status  # No pending migrations
npx prisma generate        # Prisma client up to date
```

**Check:**
- [ ] All migrations applied locally
- [ ] No pending migrations in repo
- [ ] Prisma schema consistent with migrations
- [ ] All indexes created (5 new Phase 3 indexes)
- [ ] Backup of production DB (if applicable)

**Indexes Deployed:**
- [ ] complaints(tenant_id, sla_deadline)
- [ ] escalations(complaint_id)
- [ ] escalations(tenant_id, created_at DESC)
- [ ] evidence(complaint_id)
- [ ] communications(complaint_id, created_at DESC)
- [ ] audit_logs(tenant_id, action, created_at DESC)
- [ ] systemic_clusters(tenant_id, isActive, riskLevel)

### Environment Configuration

**Production Config Verified:**
- [ ] `.env.production` has correct values (not using test/dev values)
- [ ] JWT_SECRET is secure (not default/test value)
- [ ] OpenAI API key is production key (separate from test key)
- [ ] SMTP settings point to production email service
- [ ] Database connection string is production DB
- [ ] Redis connection is production Redis
- [ ] All URLs are HTTPS (no HTTP)

**Secrets Check:**
```bash
# Verify no secrets in git history (pre-deployment)
git log --all -p | grep -i "secret\|api_key\|password" | head -20
```
- [ ] No secrets leaked in recent commits
- [ ] GitHub secrets are configured
- [ ] Vercel environment variables are set

### Feature Flag Status

**All Phase 2 Features Should Be Available:**
- [ ] Settings management: Enabled
- [ ] SMTP email sending: Enabled
- [ ] SLA calculation: Enabled
- [ ] Communication templates: Enabled
- [ ] Evidence handling: Enabled
- [ ] Compliance reporting: Enabled
- [ ] Internal notes: Enabled
- [ ] Test infrastructure: Available (non-production)

**All Phase 3 Optimizations Should Be Active:**
- [ ] Redis cache: Enabled (with graceful degradation)
- [ ] Performance monitoring: Enabled
- [ ] Rate limiting: Enabled (per-tenant + per-user)
- [ ] Audit logging: Enabled
- [ ] PII masking: Enabled
- [ ] Security headers: Enabled

---

## Deployment Process (Monday Morning)

### 1. Pre-Deployment Backup (9:00 AM)

**Critical Systems:**
- [ ] Database: Full backup created
- [ ] Redis: Data backup (if persistent state)
- [ ] Current production code: Tagged in git

**Backup Verification:**
```bash
# Tag current production version
git tag -a "pre-phase-2-3-deploy-2026-03-03" -m "Backup before Phase 2+3 deployment"
git push origin "pre-phase-2-3-deploy-2026-03-03"
```
- [ ] Backup tag created
- [ ] Can rollback if needed

### 2. Database Migration (9:30 AM)

**On Staging First (or prod during maintenance window):**
```bash
# Apply all pending migrations
npx prisma migrate deploy

# Verify migration success
npx prisma db execute "SELECT 1"  # Verify connectivity
npx prisma db validate            # Validate schema
```

**Checklist:**
- [ ] Staging migrations successful (if available)
- [ ] Production migrations successful
- [ ] No migration errors in logs
- [ ] Schema is consistent with Prisma schema

**Verify New Indexes:**
```sql
-- In production database
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('complaints', 'escalations', 'evidence', 'communications', 'audit_logs', 'systemic_clusters')
ORDER BY tablename, indexname;
```
- [ ] All 7 new indexes present in production DB

### 3. Code Deployment (10:00 AM)

**Frontend (Vercel):**
```bash
# Build and deploy frontend
npm run build  # Verify no build errors
# Push to main branch (Vercel auto-deploys)
git push origin main
```

**Deployment Steps:**
1. [ ] Verify build succeeds locally
2. [ ] Push to GitHub main branch
3. [ ] Vercel deployment starts automatically
4. [ ] Check Vercel deployment logs (no errors)
5. [ ] Frontend URL accessible: https://[platform-url]

**Backend (Deployed Service):**
```bash
# Build backend
npm run build  # Creates dist/server/ in CommonJS
# Deploy to your hosting (Vercel, Railway, Fly.io, etc.)
# Environment variables should already be set
```

**Deployment Steps:**
1. [ ] Verify server build succeeds
2. [ ] Push to deployment branch (if separate from GitHub)
3. [ ] Deployment service triggers (auto or manual)
4. [ ] Check deployment logs (no errors)
5. [ ] Health check endpoint responds: `GET /health` → 200 OK

### 4. Redis Cache Initialization (10:30 AM)

**If Redis is New:**
- [ ] Redis instance created/verified
- [ ] Connection string configured
- [ ] Cache layer tested with graceful degradation

**Warm Cache (Optional but Recommended):**
```bash
# Repopulate common cached items
POST /api/v1/admin/cache-warmup  # If endpoint available
```
- [ ] Settings cache: Populated
- [ ] Dashboard cache: Ready

### 5. Smoke Testing (11:00 AM - 12:00 PM)

**Critical User Journeys:**

**1. Complaint Intake:**
- [ ] Submit complaint (POST /api/v1/intake/submit) → 200
- [ ] Submit with evidence upload → 200
- [ ] Triage job queued → Check BullMQ
- [ ] Complaint visible in dashboard → GET /api/v1/complaints

**2. Dashboard Access:**
- [ ] Admin login → success
- [ ] Officer dashboard loads → stats visible
- [ ] Supervisor dashboard loads → escalations visible
- [ ] Executive dashboard loads → reports visible
- [ ] Dashboard stats cached (< 1 second response)

**3. Settings Management:**
- [ ] Load settings (GET /api/v1/settings) → < 50ms (cached)
- [ ] Update settings (PATCH /api/v1/settings) → 200
- [ ] Settings cache invalidated → new value returned

**4. Performance Metrics:**
- [ ] Metrics endpoint (GET /api/v1/admin/metrics) → valid JSON
- [ ] Cache hit rate showing (target: 70%+)
- [ ] Latency metrics available
- [ ] Settings queries showing 60-80% improvement

**5. Security Verification:**
- [ ] Rate limiting: Hit limit → 429 Too Many Requests
- [ ] Rate limiting: Per-tenant isolation (tenant A can't hit tenant B's limit)
- [ ] Audit logs: All mutations logged
- [ ] PII: No PII in logs (scan with grep if possible)
- [ ] Security headers present (HSTS, CSP, X-Frame-Options)

**6. AI Service:**
- [ ] AI extraction: Works on sample complaint
- [ ] AI classification: Returns category
- [ ] Confidence scores: Present and reasonable
- [ ] Error handling: Missing data → graceful error
- [ ] Retry/backoff: Test with intentional failures

**7. Email Sending:**
- [ ] SMTP configured: Can send test email
- [ ] Template system: Email contains correct variables
- [ ] Rate limiting: Emails not throttled
- [ ] Audit log: Email send logged

**Smoke Test Results:**
- [ ] All 7 journeys completed successfully
- [ ] No error logs (only info/debug)
- [ ] Performance acceptable (no timeouts)
- [ ] All data consistent

### 6. Log Review (12:00 PM)

**Check Production Logs:**
```bash
# Review last 100 lines of application logs
# Look for: ERRORS, CRITICAL, or unexpected WARNING patterns
```

**Checklist:**
- [ ] No ERROR logs in last 30 minutes
- [ ] No unhandled exceptions
- [ ] Database connections healthy
- [ ] Redis connections healthy
- [ ] AI API calls successful

### 7. Monitoring & Alerts Verification (12:30 PM)

**If Monitoring System Exists:**
- [ ] Monitoring dashboard accessible
- [ ] Key metrics visible (latency, error rate, cache hit rate)
- [ ] Alerts configured for:
  - High error rate (> 1% 5xx errors)
  - High latency (p99 > 1s)
  - Cache layer down
  - Database connection issues
- [ ] Alert channels verified (email, Slack, PagerDuty)

**Baseline Metrics to Record:**
- [ ] Average API latency: ______ ms
- [ ] p99 latency: ______ ms
- [ ] Error rate: ______ %
- [ ] Cache hit rate: ______ %
- [ ] Active connections: ______

---

## Go-Live Day (Tuesday Morning)

### 1. Final Verification (9:00 AM)

**All Systems Check:**
- [ ] Frontend: Accessible, no console errors
- [ ] Backend: Responding to requests
- [ ] Database: Queries executing normally
- [ ] Cache: Hit rates stable
- [ ] Logs: No new error patterns

### 2. User Communication (9:30 AM)

**Notify Stakeholders:**
- [ ] Email stakeholders: "Phase 2+3 now live"
- [ ] Include: Key features available, performance improvements, next steps
- [ ] Include: Support contact for any issues
- [ ] Post: Slack/internal channel announcement

### 3. First Day Monitoring (All Day)

**Every 30 minutes (or automated):**
- [ ] Error rate normal (< 1%)
- [ ] Latency normal (< 200ms average)
- [ ] No spike in error logs
- [ ] No customer complaints (check support channels)
- [ ] Cache hit rates stable (70%+)

**If Issues Found:**
1. Assess severity (critical vs. non-critical)
2. If critical: Execute rollback (see Rollback section)
3. If non-critical: Create incident ticket + fix during business hours

---

## Rollback Plan (If Needed)

### Immediate Rollback (If Critical Issue)

**Decision Criteria:**
- Issue affects core functionality (can't submit complaints, can't login, etc.)
- Issue is production-only (not reproducible in staging)
- Issue cannot be fixed in <30 minutes

**Rollback Steps:**

1. **Stop New Deployments**
   ```bash
   # Mark deployment as failed
   # Pause auto-deployment (if available)
   ```

2. **Revert Frontend**
   ```bash
   # Revert to last known good commit
   git revert [phase-2-3-deploy-commit]
   # Or rollback via Vercel dashboard
   ```

3. **Revert Backend**
   ```bash
   # Redeploy last known good version
   # Or trigger rollback in deployment system
   ```

4. **Verify Rollback**
   - [ ] Frontend loads without errors
   - [ ] Can submit complaints
   - [ ] Dashboards accessible
   - [ ] No error logs
   - [ ] Smoke tests pass

5. **Post-Rollback**
   - [ ] Notify stakeholders: "Minor issue detected, rolling back to previous version"
   - [ ] Investigate root cause
   - [ ] Fix issue locally + test thoroughly
   - [ ] Schedule re-deployment for next day

---

## Post-Deployment Monitoring (Days 2-7)

### Daily Checklist (First Week)

**Every Morning:**
- [ ] Review error logs (any new patterns?)
- [ ] Check performance metrics (any regressions?)
- [ ] Verify cache hit rates (stable at 70%+?)
- [ ] Confirm AI accuracy metrics (still 10-15% improvement?)
- [ ] Scan security audit (any new issues?)

**If Metrics Degrade:**
- [ ] Identify root cause (recent commit? data volume?)
- [ ] Assess impact (user-facing? performance only?)
- [ ] Determine fix (code change, database optimization, config change?)
- [ ] Schedule fix + re-deployment

### Weekly Metrics Review (Friday)

**Compare Against Baseline:**
- [ ] Latency: On target (30-50% improvement)?
- [ ] Cache hit rate: On target (70%+)?
- [ ] Error rate: Acceptable (< 1%)?
- [ ] Test coverage: Maintained (80%+)?
- [ ] Security audit: Passed (0 critical)?

**Success Definition:**
- ✅ All Phase 2 features working
- ✅ All Phase 3 optimizations delivering benefits
- ✅ Platform stable and performant
- ✅ Team confident in system
- ✅ Ready for Phase 4 UX work

---

## Critical Contacts & Escalation

**If Issues Arise During Deployment:**

| Role | Contact | Availability |
|------|---------|---------------|
| Backend Lead | [Name/Email] | On-call Mon 10am-2pm |
| Frontend Lead | [Name/Email] | On-call Mon 10am-2pm |
| DevOps/Infrastructure | [Name/Email] | On-call Mon 9am-12pm |
| Security Review | [Name/Email] | Available for urgent security issues |
| Executive Sponsor | [Name/Email] | Escalation for go-live decisions |

---

## Pre-Deployment Sign-Off

**All Checks Must Be Complete:**

```
☐ Code quality: TypeScript 0 errors, tests 100% passing
☐ Migrations: All applied, indexes verified
☐ Environment: Production config verified
☐ Backup: Database backup created + tagged
☐ Smoke tests: All 7 journeys successful
☐ Logs: No errors detected
☐ Monitoring: Alerts configured + verified
☐ Security: No PII in logs, headers verified
☐ Performance: Metrics baseline recorded
☐ Stakeholders: Notified of deployment plan

Lead Sign-Off: _____________ Date: _______
```

---

## Success Definition

✅ **Deployment is SUCCESSFUL when:**

1. **All Systems Online**
   - Frontend accessible and responsive
   - Backend API responding to all requests
   - Database queries executing normally
   - Redis cache operating with hit rates 70%+

2. **All Features Working**
   - Phase 2: All 8 features operational
   - Phase 3: All 4 optimizations delivering benefits
   - No regressions in existing functionality

3. **Performance Targets Met**
   - Latency: 30-50% improvement vs. pre-Phase-3
   - Cache hit rate: 70%+
   - Error rate: < 1%
   - p99 latency: < 500ms

4. **Security & Compliance**
   - 0 critical security findings
   - Rate limiting: Deployed + working
   - Audit logs: Immutable + verified
   - PII: 0 instances in logs

5. **Team Confidence**
   - All team members: System is stable
   - No major issues detected in first week
   - Metrics match expectations
   - Ready for Phase 4 work

---

## Next Steps (Post-Deployment)

**Monday-Tuesday:** Deployment + go-live
**Wednesday:** Weekly retrospective + learnings
**Thursday-Friday:** Phase 4 UX work begins (with new UX Designer)

**By End of Week:**
- ✅ Phase 2+3 stable in production
- ✅ Metrics validated
- ✅ UX Designer onboarded
- ✅ Phase 4 design work underway

---

**Let's ship Phase 2+3 successfully to production! 🚀**

