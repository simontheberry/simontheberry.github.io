# Phase 1 Startup Guide - LAUNCH TODAY 🚀

**Status:** ✅ READY TO LAUNCH
**Start Date:** 2026-02-16 (TODAY)
**Duration:** 2-3 weeks
**Team:** 2 Backend Engineers + Team Lead

---

## 📋 What You Need to Know (5-min Read)

### The Goal
Complete 4 tasks in parallel + sequence to unblock AI triage automation:
- **Week 1 (Parallel):** Task #27 (workers) + Task #28 (AI calls)
- **Week 2 (Sequence):** Task #29 (embeddings) → Task #32 (queue activation)
- **Week 3:** Testing + buffer for issues

### Success = This Works
```
1. Submit complaint via form
2. Status automatically changes: submitted → triaging → triaged
3. AI analysis shows up in results
4. Systemic patterns detected and clustered
5. All happens in background (no manual intervention)
```

### Your Part
- **BE#1:** Build BullMQ job workers (Task #27)
- **BE#2:** Wire AI service calls (Task #28)
- **Both:** After Week 1, continue sequentially with #29, #32

---

## ✅ Pre-Launch Checklist

### YOU DO THIS NOW (5 minutes):

- [ ] **Regenerate OpenAI API key** ⚠️ CRITICAL
  - Go to: https://platform.openai.com/api-keys
  - Delete the old key (exposed in chat)
  - Create new key
  - Update `.env` with new key
  - Test: `curl https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY"`

- [ ] **Verify infrastructure running**
  ```bash
  docker-compose ps
  # Should show postgres and redis as "healthy"
  ```

- [ ] **One team member claims Task #27**
  ```bash
  git checkout -b feat/task-27-workers
  ```

- [ ] **Other team member claims Task #28**
  ```bash
  git checkout -b feat/task-28-ai-calls
  ```

- [ ] **Both start dev server**
  ```bash
  npm run dev:server  # Terminal 1
  npm run dev:client  # Terminal 2
  ```

---

## 🎯 Task Details at a Glance

### Task #27 - BullMQ Job Workers (BE#1)
**What:** Build 3 background job processors
**Time:** 3-4 days
**File:** `src/server/services/queue/worker.ts`

```
Do This:
1. processTriageJob() - Run TriageEngine, save results
2. processSystemicDetection() - Run detection, create clusters
3. processSlaCheck() - Find breached SLAs, escalate

Definition of Done:
✅ Each processor has unit tests
✅ Can manually trigger job and see it process
✅ Errors logged, worker doesn't crash
✅ Ready for Task #32 integration
```

**Start with:** Understanding BullMQ basics (15 min read)
**Questions?** Ask BE#2 for 30min pair session

---

### Task #28 - AI Service Calls (BE#2)
**What:** Replace placeholder AI responses with real API calls
**Time:** 3-4 days
**Files:** `intake.routes.ts` + `communication.routes.ts`

```
Do This:
1. POST /api/v1/intake/ai-guidance → Real AI suggestions
   Input: complaint text + form data
   Output: extracted fields, confidence score

2. POST /api/v1/communications/draft → Real AI draft
   Input: complaint context + type
   Output: draft text + reasoning

Definition of Done:
✅ Both endpoints return real AI responses
✅ Confidence scores 0-1 stored
✅ Full provenance in aiOutput table
✅ Can test via API or frontend form
```

**Start with:** Understanding AIService abstraction (10 min read)
**Questions?** Ask BE#1 for 30min pair session

---

### Task #29 - pgvector Embeddings (BE#1, Week 2)
**What:** Implement vector similarity search for systemic detection
**Time:** 4-5 days
**Blocked by:** Task #27 (needs worker)

```
Do This:
1. Generate OpenAI embeddings post-triage
2. Store in complaint_embeddings table
3. Implement similarity search (pgvector <>)
4. Implement spike detection algorithm

Definition of Done:
✅ Similar complaints found and returned
✅ Spikes detected in patterns
✅ SystemicCluster records created
```

**Start:** Monday Week 2 (after #27 code review)

---

### Task #32 - Queue Activation (BE#1, Week 2)
**What:** Activate job queueing in complaint submission
**Time:** 1 day
**Blocked by:** Task #27 (worker ready)

```
Do This:
1. Uncomment queue.add() in intake.routes.ts line 170
2. Uncomment queue.add() in triage.routes.ts line 58
3. Test end-to-end: Submit complaint → job queues → processes

Definition of Done:
✅ Complaint submitted → status changes automatically
✅ Job visible in Redis queue
✅ Worker processes without error
```

**Start:** Thursday Week 2 (quick final task)

---

## 📅 Weekly Timeline

### Week 1: Parallel Implementation

```
MONDAY:
  09:00 - Standup (15 min)
    BE#1: Starting Task #27
    BE#2: Starting Task #28

  09:15 - Both start coding
    BE#1: BullMQ worker.ts
    BE#2: intake/communication routes

  15:00 - Check-in (5 min slack message)
    Any blockers yet? Need help?

TUESDAY-WEDNESDAY:
  09:00 - Standup (what done, what blocked, what next)
  Throughout: Daily sync if stuck
  15:00 - Check-in

THURSDAY:
  09:00 - Standup
  Morning: Both finalize code
  Afternoon: Code review (cross-review each other's work)

FRIDAY:
  Morning: Fix code review feedback
  Afternoon: Manual testing + integration testing
  EOD: Both PRs ready to merge to main
```

### Week 2: Sequential Implementation

```
MONDAY:
  Standup + code review merged
  BE#1 starts Task #29 (embeddings)
  BE#2 helps test and document #28

TUESDAY-WEDNESDAY:
  BE#1: Implement pgvector similarity + spike detection
  BE#2: Create test plan for integration testing

THURSDAY:
  BE#1: Finish #29
  Both: Review #29 code

FRIDAY:
  BE#1: Quick Task #32 (1 day) - activate queueing
  Both: E2E testing (complaint → auto-triage)
```

### Week 3: Testing & Buffer

```
MONDAY-TUESDAY:
  Manual testing
  Fix any bugs discovered
  Performance checks

WEDNESDAY-FRIDAY:
  Buffer for issues
  OR: Start Phase 2 early if Phase 1 complete
```

---

## 💬 Daily Standup Format (15 min, 9 AM)

**Each person answers:**
1. ✅ What did you complete yesterday?
2. 🚧 What's blocking you (if anything)?
3. 📋 What's your goal for today?

**Example:**
```
BE#1:
  ✅ Got BullMQ setup, processTriageJob working
  🚧 Not sure about TriageEngine output format
  📋 Pair with BE#2 for 30min, then implement processSystemic

BE#2:
  ✅ Intake endpoint wired to AIService
  🚧 None currently
  📋 Wire communications draft endpoint, start integration tests

Lead:
  OK - you two pair at 10 AM on TriageEngine.
  BE#2 - start tests after that pairing.
  We're on track for EOD Friday merge.
```

---

## 🛠️ Development Setup

### Terminal 1: API Server
```bash
cd /path/to/repo
npm run dev:server
# Watches src/server/ for changes
# API running on http://localhost:4000
```

### Terminal 2: Frontend
```bash
cd /path/to/repo
npm run dev:client
# Watches app/ and components/ for changes
# Frontend running on http://localhost:3000
```

### Terminal 3: Database/Redis (already running)
```bash
docker-compose ps
# Verify postgres and redis healthy
```

### Testing Code

**BE#1 (Task #27 - Test job workers):**
```bash
# Manually trigger a triage job via script
# TODO: Create test script for this
node scripts/test-queue-job.js
```

**BE#2 (Task #28 - Test AI calls):**
```bash
# Test intake guidance endpoint
curl -X POST http://localhost:4000/api/v1/intake/ai-guidance \
  -H "Content-Type: application/json" \
  -d '{
    "tenantSlug":"demo",
    "text":"Woolworths charged me twice for my groceries"
  }'

# Should return: extracted fields + confidence scores
```

---

## 📚 Key Resources

**BullMQ Workers:**
- Docs: https://docs.bullmq.io/guide/workers
- Example in codebase: Look at existing queue setup in `src/server/config/`

**OpenAI API:**
- Chat completions: https://platform.openai.com/docs/api-reference/chat
- Embeddings: https://platform.openai.com/docs/api-reference/embeddings

**pgvector:**
- Similarity search: `SELECT 1 - (embedding <=> $1) as similarity`
- Docs: https://github.com/pgvector/pgvector

**Prisma Raw SQL:**
- Docs: https://www.prisma.io/docs/reference/api-reference/prisma-client-reference#queryraw

---

## 🚨 Common Issues & Fixes

### "OpenAI API Key Error"
```bash
# Check key is in .env
grep OPENAI_API_KEY .env

# Test key directly
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR-KEY-HERE"
```

### "Redis connection failed"
```bash
# Check Redis running
docker-compose ps
# Should show redis as "healthy"

# If not, start it
docker-compose up -d redis
```

### "Database connection failed"
```bash
# Check PostgreSQL running
docker-compose ps
# Should show postgres as "healthy"

# Check schema synced
npx prisma generate
npx prisma db push
```

### "Type errors on build"
```bash
# Fix TS errors before pushing
npm run typecheck

# If errors, BE#1 & BE#2 review together
# (might be cross-task dependencies)
```

---

## ✨ Success Looks Like

### End of Week 1
- ✅ Task #27 merged to main (job workers working)
- ✅ Task #28 merged to main (AI calls working)
- ✅ Both can be tested independently
- ✅ Team confident in quality

### End of Week 2
- ✅ Task #29 merged (embeddings + similarity)
- ✅ Task #32 merged (queue activated)
- ✅ E2E flow works: submit → triage → AI analysis → clusters created
- ✅ Ready for Phase 2

### Phase 1 Complete
```
POST /api/v1/intake/submit (complaint)
  ↓
Status: submitted → triaging
Queue job created for triage
Worker picks up job (from Redis)
  ↓
TriageEngine runs
  - Extracts fields
  - Scores risk
  - Calculates priority
  - Generates summary
  ↓
Status: triaging → triaged
SystemicDetectionEngine runs
  - Generates embedding
  - Finds similar complaints
  - Detects spikes/patterns
  - Creates clusters
  ↓
All complete. UI shows:
  - Triage results with confidence
  - Similar complaints
  - Systemic alerts
  - Ready for officer review
```

---

## 🎯 Critical Reminders

✅ **Code Review:** Every PR needs 2 eyes before merge
✅ **Testing:** Each task has Definition of Done - verify before merge
✅ **Daily Sync:** 9 AM standup is non-negotiable (15 min)
✅ **Blocking Issues:** Raise immediately, don't wait
✅ **API Key:** Keep in `.env` only, never share in chat

---

## Questions?

1. **Understand the task?** Read the task card in the system
2. **Stuck on code?** Pair with other engineer (30 min)
3. **Architectural decision?** Slack team lead
4. **Dependency issue?** Mention in standup

---

## Go Time! 🚀

**Next steps:**
1. ✅ Regenerate OpenAI key (security)
2. ✅ BE#1 creates branch `feat/task-27-workers`
3. ✅ BE#2 creates branch `feat/task-28-ai-calls`
4. ✅ Both run `npm run dev:server`
5. ✅ 9 AM tomorrow: First standup

**You're ready. Let's unblock AI triage automation!**

---

**Document created:** 2026-02-16
**Phase 1 Status:** IN PROGRESS
**Estimated completion:** Week of 2026-03-02
