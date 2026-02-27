# Team Quick Reference Guide - Phase 3 Final Sprint

**Keep this handy for Thu-Fri sprint** ✨

---

## Critical Commands (Copy-Paste Ready)

### Code Quality Checks
```bash
# Check TypeScript (must be 0 errors)
npm run typecheck

# Run all tests
npm run test

# Run tests in watch mode (for continuous testing)
npm run test:watch

# Run single test file
npx vitest run path/to/file.test.ts

# Check linting
npm run lint

# Full build verification
npm run build

# Start local dev (for testing)
npm run dev
```

### Database Operations
```bash
# Generate Prisma client after schema changes
npx prisma generate

# View database with visual browser
npx prisma studio

# Create migration (for new changes)
npx prisma migrate dev --name <descriptive-name>

# Check migration status
npx prisma migrate status
```

### Background Jobs
```bash
# Start queue worker (in separate terminal)
npm run queue:worker

# Check BullMQ queue status (if UI available)
# Usually at http://localhost:8080
```

### Version Control (Before End of Day)
```bash
# Check status before commit
git status

# Stage your changes
git add <file-paths>

# Commit with clear message
git commit -m "feat: brief description of what you did"

# Push to main
git push origin main
```

---

## Key Documentation Links

**For This Week's Work:**
- 📋 **Friday Sync Agenda:** `FRIDAY_TEAM_SYNC_AGENDA.md`
- 📋 **Your Task Assignment:** Check your DM from Lead
- 📋 **Phase 3 Status:** `PROJECT_STATUS_WEEKLY.md`

**For Next Week:**
- 📋 **Phase 4 Plan:** `PHASE_4_KICKOFF_PLAN.md`
- 📋 **Deployment Checklist:** `DEPLOYMENT_CHECKLIST_PHASE_2_3.md`

**For Reference:**
- 📋 **Project CLAUDE.md:** `CLAUDE.md` (project guidelines)
- 📋 **Architecture:** Check `CLAUDE.md` for monorepo structure

---

## What Each Team Member Is Working On

### 🔵 Backend Engineer (Task #43)
**Focus:** Performance Monitoring & Observability
```
Days 1-2: Cache metrics collection (hit/miss ratios, latency)
Days 2-3: OpenTelemetry setup (APM tracing)
Day 4:    Metrics endpoint + admin dashboard
```
**Success:** Cache hit rates 70%+, latency improvements validated
**Key Files:**
- `src/server/services/cache/redis-cache.ts` - add metrics
- `src/server/api/routes/settings.routes.ts` - log effectiveness
- `src/server/api/routes/dashboard.routes.ts` - measure stats

### 🟢 Frontend Engineer (Task #34)
**Focus:** Comprehensive Test Suite (80%+ coverage)
```
Mon-Tue: Service tests expansion (70 tests)
Wed:     Route + security tests (90 tests)
Thu:     Final push → 80%+ coverage
```
**Success:** 80%+ coverage, 156+ tests, all passing
**Key Files:**
- `tests/` directory (69 example suites to expand)
- `vitest.config.ts` (test configuration)
- Run: `npm run test:watch`

### 🟣 AI Engineer (Task #46)
**Focus:** AI Infrastructure Hardening (10-15% accuracy improvement)
```
Days 1-2: Zod validation + retry/backoff
Days 2-3: Prompt specialization + confidence calibration
Days 3-4: Token optimization + temperature tuning
```
**Success:** 10-15% accuracy, infrastructure production-ready
**Key Files:**
- `src/server/services/ai/ai-service.ts`
- `src/server/services/ai/provider.ts`
- `src/server/services/ai/prompts.ts`

### 🟡 Security Officer (Task #47)
**Focus:** Security Hardening (0 critical findings)
```
Days 1-2: Per-tenant rate limiting
Days 2-3: Audit log immutability + PII detection
Days 3-4: Encryption verification + security headers
```
**Success:** 0 critical findings, rate limiting deployed, audit passed
**Key Files:**
- `src/server/api/middleware/` (rate limiting, auth)
- `src/server/config/` (environment verification)
- `helmet.js` configuration (security headers)

---

## Daily Checklist (Thu-Fri)

### ✅ Every Morning
```
□ Pull latest main branch (git pull origin main)
□ npm run typecheck → must be 0 errors
□ npm run test → must be 100% passing
□ Start npm run test:watch (for continuous feedback)
```

### ✅ Throughout the Day
```
□ Commit progress regularly (don't wait until EOD)
□ Test your changes locally before committing
□ Flag any blockers immediately (message Lead)
□ Document what you've done (for Friday sync)
```

### ✅ End of Day
```
□ Final commit with clear message
□ Push to main (git push origin main)
□ Leave notes for next day (if relevant)
□ Prepare 5-min Friday sync summary (metric/findings)
```

---

## Friday Sync Preparation (by 4pm)

### What to Prepare (5-min summary for each stream):

**Backend Engineer:**
- Cache hit rate % (target: 70%+)
- Latency improvements: before/after
  - Settings: 60-80% reduction
  - Dashboard: 85%+ reduction
- Any challenges overcomed?

**Frontend Engineer:**
- Final test coverage % (target: 80%+)
- Total test count (target: 156+)
- All tests passing? ✅
- Any interesting test patterns?

**AI Engineer:**
- Accuracy improvements % (target: 10-15%)
- Confidence calibration findings
- Any model behavior surprises?
- Production readiness assessment

**Security Officer:**
- Critical findings count (target: 0)
- High/medium findings found + fixed
- Rate limiting effectiveness
- Overall security posture

---

## Help & Support

### If You're Blocked
1. **Quick question?** Message in team channel
2. **Need pair programming?** Message Lead (I'll help immediately)
3. **Technical issue?** Check:
   - CLAUDE.md for architecture guidance
   - Existing code patterns for similar functionality
   - Tests for expected behavior

### If Code Quality Issues

**TypeScript Errors:**
```bash
# Find the error file and line
npm run typecheck

# Fix type issues (usually adding : Type or as const)
# Common fixes:
#   - Add explicit types to parameters
#   - Use 'as const' for constants
#   - Import missing types
```

**Test Failures:**
```bash
# Run only failing test
npx vitest run tests/path/to/failing.test.ts

# Look at error message + fix
# If test is wrong, fix test
# If code is wrong, fix code
```

**Lint Warnings:**
```bash
npm run lint

# Most lint issues can auto-fix
npx next lint --fix
```

---

## Success Checklist (Friday 4pm)

### All Team Members
```
□ Task work: 100% complete
□ Code: TypeScript 0 errors
□ Tests: 100% passing
□ Commits: Pushed to main
□ 5-min summary: Prepared for sync
□ Ready to present metrics: YES
```

### Specific Targets

**Backend:** Cache metrics + latency improvements documented
**Frontend:** 80%+ coverage achieved + test count
**AI:** Accuracy improvements + confidence validation documented
**Security:** 0 critical findings + audit results documented

---

## Resources Available

### Testing
- 69 example test suites in `tests/` directory
- Test patterns documented in `tests/README.md`
- Factory functions in `tests/factories.ts`

### Code Examples
- Settings routes: `src/server/api/routes/settings.routes.ts`
- Dashboard routes: `src/server/api/routes/dashboard.routes.ts`
- AI service: `src/server/services/ai/ai-service.ts`

### Documentation
- CLAUDE.md: Architecture + patterns
- Database schema: `prisma/schema.prisma`
- Type definitions: `src/shared/types/`

---

## Emergency Escalation (If Critical Issue)

**If Something is Critically Broken:**

1. **Stop other work**
2. **Assess severity:**
   - Can 80% of team keep working? → Non-critical
   - Can platform still receive complaints? → Critical
3. **Message Lead immediately** (don't wait)
4. **Lead decides:**
   - Fix now (impacts Friday deadline)
   - Push to after Friday
   - Workaround + fix later

**No one gets left behind.** Team helps unblock quickly.

---

## Morale Check-In

**You're doing incredible work.**

Phase 3 has been:
- Backend: 30-50% performance improvement ✨
- Frontend: 80%+ test coverage ✨
- AI: 10-15% accuracy improvement ✨
- Security: 0 critical findings ✨

**That's production-grade work.** Government regulators depend on this. Be proud.

**Friday sync = celebration.** Then you get the weekend off. You've earned it. 🎉

---

## Quick FAQ

**Q: Do I need to commit daily?**
A: Yes. Small, frequent commits are better than one big one.

**Q: What if I'm not done by Friday?**
A: Tell Lead ASAP. We adjust + help. No one left behind.

**Q: Can I do exploratory work after Friday?**
A: After Friday sync, yes. Phase 4 starts Monday but different focus.

**Q: Who do I ask for help?**
A: Message Lead in team channel (immediate response).

**Q: Should I optimize for clean code or speed?**
A: Speed first (Friday deadline matters). Clean up after if needed.

---

## Let's Finish Strong! 🚀

**Timeline:**
- Today (Thu): Final work push
- Tomorrow (Fri 4pm): Sync + celebrate
- Monday: Deploy + Phase 4 begins

**You've got this. Team is coordinated. Finish strong.** ✨

