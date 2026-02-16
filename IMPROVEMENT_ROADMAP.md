# Complaint Platform Improvement Roadmap

**Status:** Phase 1 Ready (2-3 weeks)
**Total Effort:** ~9-11 weeks for all 17 tasks (with contingency buffer)
**Approach:** Divide-and-conquer with parallel workstreams + 1 week contingency
**Last Updated:** 2026-02-16 (Revised with scope adjustments)

---

## Overview: 5-Phase Implementation Plan

```
PHASE 1: Unblock AI Pipeline (2-3 weeks)
└─ CRITICAL: Enable core triage automation

PHASE 2: Operational Features (1-2 weeks)
└─ HIGH: Complete admin configuration and SLA tracking

PHASE 3: Safety & Quality (1 week)
└─ HIGH: Test suite with full coverage

PHASE 4: UX & Customization (2-3 weeks)
└─ MEDIUM: Improve user experience and regulator customization

PHASE 5: Operations & Monitoring (1-2 weeks)
└─ MEDIUM: Deployment and observability
```

---

## PHASE 1: Unblock AI Pipeline (2-3 weeks)

**Goal:** Enable AI analysis, background job processing, and systemic detection

**Workstream A: Background Infrastructure** (Backend Engineer #1)
- **Task #27:** Implement BullMQ job workers
  - Files: `src/server/services/queue/worker.ts`
  - Time: 3-4 days
  - Dependencies: None
  - Deliverables:
    - `processTriageJob()` - instantiate TriageEngine, execute, store results
    - `processSystemicDetection()` - instantiate SystemicDetectionEngine, create clusters
    - `processSlaCheck()` - find breached SLAs, escalate, send notifications
  - Definition of Done: Unit tests pass, local worker processes jobs

**Workstream B: AI Integration** (Backend Engineer #2)
- **Task #28:** Wire AI service calls
  - Files: `src/server/api/routes/intake.routes.ts`, `communication.routes.ts`
  - Time: 3-4 days
  - Dependencies: None (independent)
  - Deliverables:
    - POST /api/v1/intake/ai-guidance returns real AI suggestions
    - POST /api/v1/communications/draft generates real drafts
    - Store provenance: model, prompt, output, confidence
  - Definition of Done: AI calls work, confidence scores stored

**Workstream C: Vector Search** (Backend Engineer #1 after #27)
- **Task #29:** Implement pgvector embeddings
  - Files: `src/server/services/systemic/detection-engine.ts`
  - Time: 4-5 days
  - Dependencies: Task #27 (needs worker to run)
  - Deliverables:
    - Generate embeddings post-triage via OpenAI ada-002
    - Store in complaint_embeddings table
    - Implement similarity search with pgvector `<=>`
    - Implement spike detection algorithm
  - Definition of Done: Similar complaints returned, spikes detected

**Workstream D: Queue Integration** (Backend Engineer #1 after both complete)
- **Task #32:** Activate triage job queueing
  - Files: `src/server/api/routes/intake.routes.ts`, `triage.routes.ts`
  - Time: 1 day
  - Dependencies: Task #27 complete
  - Deliverables:
    - Uncomment and activate queue.add() calls
    - Verify complaint submission → job queued → worker processes
  - Definition of Done: End-to-end triage automation works locally

### Phase 1 Success Criteria
✅ Submit complaint → AI analyzes it
✅ Systemic patterns detected and clustered
✅ Background jobs process without errors
✅ Test: Complaint flow: submitted → triaging → triaged

### Phase 1 Timeline
```
Week 1:
  Mon-Wed: Task #27 & #28 in parallel (3 days)
  Thu-Fri: Code review, initial testing (2 days)

Week 2:
  Mon-Wed: Task #29 implementation (3 days)
  Thu: Task #32 integration (1 day)
  Fri: End-to-end testing & debugging (1 day)

Week 3 (optional):
  Buffer for issues discovered in testing
```

---

## PHASE 2: Operational Features (1-2 weeks)

**Goal:** Complete admin configuration, SLA tracking, and email delivery

**Workstream A: Admin Settings & Branding** (Backend Engineer #1)
- **Task #30:** Settings endpoint + admin UI (expanded scope)
  - Files: `src/server/api/routes/settings.routes.ts`, `app/dashboard/settings/page.tsx`
  - Time: 3-4 days (expanded from 2-3)
  - Dependencies: Phase 1 complete
  - Deliverables:
    - GET /api/v1/settings - fetch tenant settings
    - PATCH /api/v1/settings - update with validation
    - Settings form with weight constraints
    - **NEW:** Logo upload to S3 (with fallback to local storage)
    - **NEW:** Brand color customization (primary/accent)
    - **NEW:** Terminology customization (complaint vs allegation vs report)
    - Audit logging for all changes
  - Definition of Done: Admins can configure weights, SLA, branding, terminology. Logos persist and display on complaint pages

**Workstream B: Email Delivery** (Backend Engineer #2)
- **Task #31:** SMTP email sending
  - Files: `src/server/services/email/sender.ts`, `queue/worker.ts`
  - Time: 2-3 days
  - Dependencies: Task #27 (needs worker)
  - Deliverables:
    - SMTP service with nodemailer
    - Email queue processor with retry logic
    - Template variable substitution
    - Bounce handling
  - Definition of Done: Emails actually delivered when communications sent

**Workstream C: SLA Automation** (Backend Engineer #1 after #30)
- **Task #33:** SLA calculation and escalation
  - Files: `src/server/services/queue/worker.ts`, `complaint.routes.ts`
  - Time: 2-3 days
  - Dependencies: Task #27, #30
  - Deliverables:
    - Calculate slaDeadline at triage time
    - processSlaCheck() finds breaches and escalates
    - Officer notifications before deadline
    - SLA metrics dashboard
  - Definition of Done: Complaints escalate automatically when SLA breached

### Phase 2 Success Criteria
✅ Admins can configure platform settings
✅ Communications send via email
✅ SLA deadlines calculated and monitored
✅ Automatic escalations trigger

### Phase 2 Timeline
```
Week 4:
  Mon-Tue: Task #30 backend (2 days - settings endpoints)
  Wed-Fri: Task #31 email service (3 days)

Week 5:
  Mon-Tue: Task #30 frontend & branding (2 days - UI, logo upload, colors)
  Wed: Task #33 SLA logic (1 day)
  Thu-Fri: Testing, integration, debugging (2 days)
```

---

## PHASE 3: Safety & Quality (1 week)

**Goal:** Build test coverage to enable safe refactoring and prevent regressions

**Workstream: Testing** (QA/Testing Engineer)
- **Task #34:** Comprehensive test suite with vitest
  - Files: `vitest.config.ts`, `tests/` directory
  - Time: 5-6 days
  - Dependencies: Phase 1 & 2 complete (tests what was built)
  - Deliverables:
    - vitest configuration with path aliases
    - **SQLite in-memory** for fast CI/CD pipeline
    - Unit tests: priority calculation, risk mapping, hashing, JWT
    - Integration tests: complaint flow, triage, RBAC, tenant isolation
    - Systemic detection tests: similarity, spikes, clustering
    - E2E tests: complaint → assignment → resolution workflows
    - Target: >80% coverage
    - **Manual PostgreSQL testing** checklist for developers before PR merge (migration compatibility, index performance)
  - Definition of Done: `npm run test` passes all tests, CI-ready. New PRs require manual PostgreSQL test sign-off

### Phase 3 Success Criteria
✅ Test suite covers core services (>80%)
✅ Regression tests for critical paths
✅ Test database seeding works
✅ Team confident in refactoring

### Phase 3 Timeline
```
Week 6:
  Mon-Tue: Setup vitest, fixtures, seeding (2 days)
  Wed-Fri: Unit & integration tests (3 days)

Week 7 (optional):
  Mon: E2E tests & final review
```

---

## PHASE 4: UX & Customization (2-3 weeks)

**Goal:** Improve user experience and enable regulator customization

**Workstream A: Operations & Features** (Backend Engineer #1)
- **Task #35:** Communication templates CRUD
  - Time: 2 days
  - Files: `communication.routes.ts`, `components/dashboard/TemplateManager.tsx`
  - Deliverables: Template management with variables, preview

- **Task #37:** Audit logging + compliance reports
  - Time: 2 days
  - Files: `admin.routes.ts`, `services/audit/`
  - Deliverables: Audit query endpoint, PII scrubbing, compliance reports

- **Task #38:** Internal notes + team collaboration
  - Time: 2 days
  - Files: `notes.routes.ts`, `components/complaint/NotesSection.tsx`
  - Deliverables: Notes, mentions, threading

- **Task #39:** Multi-tenant customization
  - Time: 3-4 days
  - Files: Prisma schema, `settings.routes.ts`
  - Deliverables: Per-tenant categories, branding, SLA templates

**Workstream B: User Experience** (Frontend Engineer)
- **Task #36:** Evidence/attachment upload
  - Time: 2 days
  - Files: `evidence.routes.ts`, `components/complaint/EvidenceUploadArea.tsx`
  - Deliverables: File upload, download, soft delete

- **Task #40:** Case management state machine
  - Time: 2 days
  - Files: `services/workflow/state-machine.ts`, `complaint.routes.ts`
  - Deliverables: Strict state transitions, workflow validation

- **Task #41:** Conversational complaint intake UI
  - Time: 5-6 days (expanded from 3-4)
  - Files: `app/complaint-form/page.tsx`, `components/intake/`
  - Deliverables:
    - Step-by-step wizard (7 steps with back navigation)
    - AI guidance panel with confidence scores
    - ABN auto-lookup with Woolworths example working
    - File upload with drag-and-drop
    - Progress saving to localStorage
    - Mobile-responsive design
    - Estimated effort: Form redesign + API integration + UX polish

### Phase 4 Success Criteria
✅ Complaint intake feels conversational and guided
✅ Business lookup auto-completes (Woolworths example works)
✅ Team can collaborate with internal notes
✅ Admins can customize categories and branding
✅ Audit trail complete for compliance

### Phase 4 Timeline (Expanded to 3-4 weeks)
```
Week 7-8:
  Backend: Tasks #35, #37, #38 in parallel (2-3 days each)
  Frontend: Task #36, #40 in parallel (2 days each)

Week 8-9:
  Backend: Task #39 (3-4 days)
  Frontend: Task #41 (5-6 days, runs concurrent with backend)

Week 9-10:
  Integration testing, code review, refinement (3-4 days)

Week 10:
  Buffer for issues discovered in testing (1-2 days)
```

---

## PHASE 5: Operations & Monitoring (1-2 weeks)

**Goal:** Production-ready deployment and observability

**Workstream A: Deployment** (DevOps/Backend)
- **Task #42:** Docker configuration
  - Time: 2 days
  - Files: `Dockerfile`, `docker-compose.yml`, `.env.example`
  - Deliverables: Multi-stage build, compose stack, health checks

**Workstream B: Observability** (Backend Engineer)
- **Task #43:** Performance monitoring
  - Time: 2 days
  - Files: `services/metrics.ts`, `api/health.routes.ts`
  - Deliverables: Health endpoint, metrics collection, dashboard

### Phase 5 Success Criteria
✅ `docker-compose up` starts full stack
✅ Health endpoint returns status
✅ Metrics visible on admin dashboard
✅ Platform ready for production deployment

### Phase 5 Timeline
```
Week 10:
  Mon-Tue: Task #42 Docker (2 days)
  Wed-Thu: Task #43 Observability (2 days)
  Fri: Integration testing
```

---

## Task Dependency Map

```
PHASE 1:
┌─ Task #27 (Workers)
│  ├─→ Task #29 (Embeddings)
│  ├─→ Task #32 (Queue integration)
│  └─→ Task #33 (SLA checking)
│
├─ Task #28 (AI calls) [independent]
│
└─ Task #32 depends on #27

PHASE 2:
├─ Task #30 (Settings) [independent of Phase 1 completion]
├─ Task #31 (Email) → depends on #27
└─ Task #33 (SLA) → depends on #27, #30

PHASE 3:
└─ Task #34 (Tests) → depends on #27, #28, #29, #31, #33

PHASE 4:
├─ Task #35 (Templates) [independent]
├─ Task #36 (Evidence) [independent]
├─ Task #37 (Audit) [independent]
├─ Task #38 (Notes) [independent]
├─ Task #39 (Customization) [independent]
├─ Task #40 (State machine) [independent]
└─ Task #41 (Intake UI) [depends on Task #28 for AI guidance]

PHASE 5:
├─ Task #42 (Docker) [independent]
└─ Task #43 (Monitoring) [independent]
```

---

## Recommended Team Structure

### Team Lead / Architect
- Oversee all phases
- Manage dependencies and blockers
- Coordinate between engineers
- Do code reviews

### Backend Engineers (2 people)
**Engineer #1:**
- Phase 1A: Task #27 (workers)
- Phase 1C: Task #29 (embeddings)
- Phase 1D: Task #32 (queueing)
- Phase 2A: Task #30 (settings)
- Phase 2C: Task #33 (SLA)
- Phase 4A: Tasks #35, #37, #38, #39
- Phase 5B: Task #43 (monitoring)

**Engineer #2:**
- Phase 1B: Task #28 (AI calls)
- Phase 2B: Task #31 (email)
- Phase 4A: Task #40 (state machine)
- Phase 5A: Task #42 (Docker)

### Frontend Engineer
- Phase 4B: Tasks #36, #41
- Phase 4A: Task #35, #38 (UI components)

### QA/Testing Engineer
- Phase 3: Task #34 (test suite)
- All phases: Testing as work completes

---

## Success Metrics by Phase

### Phase 1 Success
- [ ] Background worker processes 100% of queued jobs
- [ ] AI analysis completes within 5 seconds
- [ ] Systemic clusters created for patterns
- [ ] Zero job processing errors in testing

### Phase 2 Success
- [ ] Settings endpoint saves and loads correctly
- [ ] Emails send within 60 seconds of approval
- [ ] SLA calculations match expected values
- [ ] Escalations trigger automatically

### Phase 3 Success
- [ ] Test suite covers >80% of backend code
- [ ] All critical paths have E2E tests
- [ ] CI passes on every commit

### Phase 4 Success
- [ ] Intake form users report better experience
- [ ] Complaint form remembers progress
- [ ] ABN lookup auto-completes Woolworths
- [ ] Internal notes enable team collaboration
- [ ] Admins can customize categories

### Phase 5 Success
- [ ] Stack starts with `docker-compose up`
- [ ] Health endpoint responds in <100ms
- [ ] Metrics dashboard shows system health
- [ ] Ready for staging/production deployment

---

## Known Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Redis connection issues | Tasks #27, #31 blocked | Test Redis health check early |
| AI API quota limits | Task #28 fails | Implement rate limiting, monitor usage |
| Embedding generation slow | Task #29 performance | Batch embed generation, cache results |
| Email delivery unreliable | Task #31 issues | Use SES or SendGrid instead of raw SMTP |
| Database query performance | Phase 4 bottleneck | Profile queries, add indexes early |

---

## Contingency Buffer

**1 Week Built-in Buffer:** Week 11
- Use if Phase 4 encounters issues
- Or if Phase 5 scope expands
- OR: Start Phase 5 on schedule if Phase 4 completes early

This brings total timeline from **8-10 weeks** to **9-11 weeks** with contingency.

---

## Getting Started

### Before Phase 1
- [ ] Ensure Redis is running and accessible
- [ ] Verify OpenAI API key is configured
- [ ] PostgreSQL database is seeded with test data
- [ ] All team members have code review permissions

### During Each Phase
- Daily standup (15 min)
- Code review before merge (2+ people)
- Testing in staging before main
- Document blockers immediately

### At End of Each Phase
- Run full test suite
- Performance check (no regressions)
- Staging deployment test
- Demo to stakeholder

---

## Additional Notes

### For ACCC/ASIC/ACMA Deployment
- Task #39 (customization) enables per-regulator configuration
- Each gets separate tenant with custom categories
- Branding/logo per tenant
- SLA templates per regulator type

### For State Regulators (NSW Fair Trading, etc.)
- Task #39 supports state-level tenants
- Can customize complaint categories for state industry focus
- Separate escalation chains per state
- Multi-state ACCC can see all data

### Future Work (Post-MVP)
- Task #28 could add Claude for analysis in future
- Task #39 could add role-based field customization
- Mobile app for complaint submission
- Real-time collaboration (WebSocket)
- Webhook notifications for external systems

---

**Document Status:** Reviewed and Adjusted (2026-02-16)
**Adjustments Made:**
- Task #29: Full embeddings implementation (confirmed)
- Task #30: Expanded to include branding (logo, colors, terminology) → 3-4 days
- Task #41: Expanded intake UI design → 5-6 days
- Phase 4: Extended to 3-4 weeks (from 2-3)
- Phase 3: Hybrid testing approach (SQLite CI + manual PostgreSQL)
- Overall: Added 1-week contingency buffer after Phase 4

**Total Timeline:** 9-11 weeks (from 8-10)

**Next Step:** Team lead creates task assignments, Phase 1 begins Monday
