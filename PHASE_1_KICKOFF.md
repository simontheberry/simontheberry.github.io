# Phase 1 Kickoff - Ready to Go! 🚀

**Status:** ✅ ALL INFRASTRUCTURE READY
**Start Date:** 2026-02-16 (NOW)
**Duration:** 2-3 weeks
**Team:** 2 Backend Engineers, Team Lead

---

## ✅ Infrastructure Verified

- ✅ **PostgreSQL** running on localhost:5432
  - Database: `complaint_triage`
  - pgvector extension available
  - Schema synced via Prisma

- ✅ **Redis** running on localhost:6379
  - Ready for BullMQ queues

- ✅ **Environment (.env)**
  - Created with development defaults
  - ⚠️ IMPORTANT: Add your OpenAI API key to `.env` before starting Task #28
    ```bash
    OPENAI_API_KEY=sk-your-actual-key-here
    ```

- ✅ **Dependencies**
  - npm packages installed
  - Prisma client generated
  - Type checking configured

---

## 📋 Phase 1 Task Assignments

### Week 1 (Parallel Work)

#### Backend Engineer #1: Task #27 - BullMQ Job Workers
- **Status:** Ready to claim
- **Effort:** 3-4 days
- **Files:**
  - `src/server/services/queue/worker.ts` (main implementation)
  - `src/server/services/triage/engine.ts` (already exists)
  - `src/server/services/systemic/detection-engine.ts` (already exists)

- **What to build:**
  1. Implement `processTriageJob()` - takes complaint, runs TriageEngine, saves results
  2. Implement `processSystemicDetection()` - takes complaints, runs detection, creates clusters
  3. Implement `processSlaCheck()` - finds breached SLAs, escalates, sends notifications

- **Definition of Done:**
  - Unit tests for each processor (basic happy path)
  - Can manually trigger job via script and see it process
  - Errors logged but don't crash worker
  - Ready for Task #32 integration

- **Tips:**
  - Start by understanding BullMQ queue basics (5 min read)
  - Look at existing TriageEngine and SystemicDetectionEngine to see what they return
  - Don't worry about email notifications yet (Task #31) - just log for now
  - Test locally with `npm run dev:server` and a manual queue job script

#### Backend Engineer #2: Task #28 - AI Service Calls
- **Status:** Ready to claim (once OpenAI key is in .env)
- **Effort:** 3-4 days
- **Files:**
  - `src/server/api/routes/intake.routes.ts` (line 201)
  - `src/server/api/routes/communication.routes.ts` (line 46)
  - `src/server/services/ai/provider.ts` (extend with new methods)
  - `src/server/services/ai/prompts.ts` (add new prompts)

- **What to build:**
  1. Replace hardcoded response in POST /api/v1/intake/ai-guidance with real AI call
     - Input: complaint text + current form data
     - Output: extracted fields, missing fields, follow-up questions
     - Store confidence score (0-1)

  2. Replace placeholder in POST /api/v1/communications/draft with real AI call
     - Input: complaint context, communication type
     - Output: draft text, confidence, reasoning
     - Store full provenance in aiOutput table

- **Definition of Done:**
  - `POST /api/v1/intake/ai-guidance` returns real AI suggestions with confidence
  - `POST /api/v1/communications/draft` generates real draft with provenance
  - Can test via frontend form or API directly
  - Error handling for API quota/network issues

- **Tips:**
  - Provider abstraction already exists - add new methods to AIService
  - Check CLAUDE.md for prompt guidelines (JSON mode, temp 0.1)
  - Start with intake guidance (simpler), then do draft generation
  - Test with curl: `curl -X POST http://localhost:4000/api/v1/intake/ai-guidance -H "Content-Type: application/json" -d '{"tenantSlug":"demo","text":"..."}'`

---

### Week 1 - Code Review & Testing

- **Thu-Fri:** Code review of #27 and #28
  - Each engineer reviews the other's code
  - Run linting: `npm run lint`
  - Run type check: `npm run typecheck`
  - Manual testing in Postman/curl

---

### Week 2 (Sequential: #27 → #29 → #32)

#### Backend Engineer #1 (continued): Task #29 - pgvector Embeddings
- **Status:** Blocked by Task #27 (needs worker)
- **Effort:** 4-5 days
- **Start:** Monday Week 2 (after #27 code review)

- **What to build:**
  1. Post-triage: Generate embedding for complaint `rawText` via OpenAI ada-002
  2. Store embedding in `complaint_embeddings` table (use raw SQL, Prisma doesn't support pgvector natively)
  3. Implement similarity search using pgvector `<=>` (cosine distance)
  4. Implement spike detection algorithm (compare to 7-day baseline)
  5. Wire into systemic detection job (so it runs when #27 completes)

- **Tips:**
  - pgvector docs: https://github.com/pgvector/pgvector
  - Use: `prisma.$queryRaw` for raw SQL with vectors
  - Test: `SELECT 1 - (embedding <=> $1) as similarity FROM complaint_embeddings...`
  - Start with similarity search, then add spike detection

#### Backend Engineer #1: Task #32 - Activate Queue
- **Status:** Blocked by Task #27
- **Effort:** 1 day
- **Start:** Thursday Week 2 (quick final task after #29)

- **What to do:**
  - Uncomment `queue.add()` calls in:
    - `src/server/api/routes/intake.routes.ts` line 170
    - `src/server/api/routes/triage.routes.ts` line 58
  - Test end-to-end: Submit complaint → job queued → worker processes → status changes
  - Verify in Redis: `redis-cli` → `KEYS *` to see queue data

---

### Week 2 - Testing & Integration

- **Fri Week 2:** E2E testing
  - Submit complaint via form
  - Verify triage runs in background
  - Verify systemic clusters created
  - Check all without errors

- **Fri-Week 3 (Optional):** Debug any issues from testing

---

## 🎯 Phase 1 Success Criteria

✅ **Definition of Done (All must pass):**
1. Submit complaint → status changes from `submitted` → `triaging` → `triaged` (automatically)
2. AI analysis completes within 5 seconds per complaint
3. Systemic clusters created when patterns detected
4. Background jobs complete without crashing worker
5. Error logs captured (no silent failures)
6. Code passes: `npm run typecheck` and `npm run lint`
7. All changes have unit tests (minimum)
8. Ready for Phase 2

---

## 📌 Daily Standup Format

**Daily at:** 9:00 AM (15 min)

**Each engineer:**
1. What did you complete yesterday?
2. What's the blocker (if any)?
3. What's next today?

**Team Lead:**
- Note blockers and help remove them
- Track against timeline

**Example:**
```
BE#1: "Finished processTriageJob(), it's calling TriageEngine correctly.
       Blocked on: understanding SystemicDetectionEngine output format.
       Today: Pair with BE#2 to understand, then implement processSystemic..."

BE#2: "Wired intake AI guidance endpoint. OpenAI API key needed to test.
       Blocked: Waiting on OpenAI key.
       Today: Set up tests, then integrate once key available."

Lead: "BE#1/BE#2 - let's pair 30min today on DetectionEngine. BE#2 - get OpenAI key by EOD."
```

---

## 🚀 How to Get Started RIGHT NOW

### Step 1: Add OpenAI API Key (5 min)
```bash
# Edit .env and add your OpenAI key
nano .env

# Find this line and add your key:
# OPENAI_API_KEY=sk-YOUR-KEY-HERE
```

### Step 2: Start Local Dev Server (5 min)
```bash
# Terminal 1: Start API server
npm run dev:server

# Terminal 2: Start Next.js frontend
npm run dev:client
```

### Step 3: Claim Your Task
```bash
# BE#1: Claim Task #27
# BE#2: Claim Task #28
# Both: Create a branch
git checkout -b feat/task-27-workers
git checkout -b feat/task-28-ai-calls
```

### Step 4: Start Coding
- BE#1: Open `src/server/services/queue/worker.ts` and start on `processTriageJob()`
- BE#2: Open `src/server/api/routes/intake.routes.ts` line 201 and start AI integration

---

## 📚 Helpful Resources

**BullMQ:**
- Docs: https://docs.bullmq.io/
- Queue basics: 5 min read
- Example: Look at existing queue setup in `src/server/config/`

**pgvector:**
- Docs: https://github.com/pgvector/pgvector
- Postgres similarity: `SELECT 1 - (embedding <=> $1) as similarity`

**OpenAI API:**
- Docs: https://platform.openai.com/docs
- Embeddings: https://platform.openai.com/docs/guides/embeddings
- Chat completions: https://platform.openai.com/docs/api-reference/chat

**Prisma Raw Queries:**
- Docs: https://www.prisma.io/docs/reference/api-reference/prisma-client-reference#queryraw

---

## 🚨 If You Get Stuck

1. **BE#1 (Task #27):** Confused about TriageEngine?
   - Read: `src/server/services/triage/engine.ts`
   - Slack: BE#2 for 15min pair

2. **BE#2 (Task #28):** OpenAI API errors?
   - Check: `.env` has valid key
   - Test: `curl https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY"`
   - Check: Usage/quota at https://platform.openai.com/account/usage/overview

3. **Either:** Database connection issues?
   - Verify: `psql -U postgres -h localhost -d complaint_triage -c "SELECT 1"`
   - Check Docker: `docker-compose ps`

4. **Questions?** Slack team lead for pair programming session

---

## 📈 Progress Tracking

Tasks:
- [ ] Task #27 claimed by BE#1
- [ ] Task #28 claimed by BE#2
- [ ] Task #27 code review passed
- [ ] Task #28 code review passed
- [ ] Task #29 started (Week 2)
- [ ] Task #32 started (Week 2)
- [ ] E2E testing passed
- [ ] Phase 1 complete ✅

---

**Good luck! You've got this. 🎯**

Questions? Ping the team lead or check PHASE_1_READINESS.md for troubleshooting.
