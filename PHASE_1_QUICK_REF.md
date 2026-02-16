# Phase 1 Quick Reference Card

**Print this out and keep nearby! 📌**

---

## Today's Checklist

- [ ] Regenerate OpenAI API key (security!)
- [ ] Verify `docker-compose ps` shows postgres + redis healthy
- [ ] BE#1: `git checkout -b feat/task-27-workers`
- [ ] BE#2: `git checkout -b feat/task-28-ai-calls`
- [ ] Both: `npm run dev:server` (terminal 1)
- [ ] Both: `npm run dev:client` (terminal 2)
- [ ] Both: Start coding!

---

## Your Task at a Glance

### BE#1 - Task #27 (BullMQ Workers)
**File:** `src/server/services/queue/worker.ts`

**Build 3 functions:**
```typescript
async processTriageJob(job) {
  // 1. Instantiate TriageEngine
  // 2. Run engine on complaint
  // 3. Save results to complaint table
}

async processSystemicDetection(job) {
  // 1. Instantiate SystemicDetectionEngine
  // 2. Run detection on all complaints
  // 3. Create SystemicCluster records
}

async processSlaCheck(job) {
  // 1. Find complaints past slaDeadline
  // 2. Escalate them
  // 3. Send notifications
}
```

**Done when:**
- Unit tests pass
- Manual job trigger works
- Ready for Task #32

---

### BE#2 - Task #28 (AI Calls)
**Files:** `src/server/api/routes/intake.routes.ts` + `communication.routes.ts`

**Replace 2 placeholders:**
```typescript
// Line 201 in intake.routes.ts
POST /api/v1/intake/ai-guidance
Input: { text, currentData }
Output: { extractedData, missingFields, confidence }

// Line 46 in communication.routes.ts
POST /api/v1/communications/draft
Input: { complaintId, type }
Output: { body, confidence, reasoning }
```

**Done when:**
- Both endpoints return real AI responses
- Confidence scores stored (0-1)
- Can test via curl/Postman

---

## Daily Standup (9 AM, 15 min)

**Format:**
```
BE#1: ✅ [what done] | 🚧 [blocker] | 📋 [today's goal]
BE#2: ✅ [what done] | 🚧 [blocker] | 📋 [today's goal]
Lead: [decisions/help]
```

---

## Command Cheatsheet

```bash
# Start dev servers
npm run dev:server  # Terminal 1: API on :4000
npm run dev:client  # Terminal 2: Frontend on :3000

# Type check (before committing)
npm run typecheck

# Lint check (before committing)
npm run lint

# Build (verify before push)
npm run build

# Create feature branch
git checkout -b feat/task-27-workers

# Commit + push
git add .
git commit -m "feat: task 27 implementation"
git push origin feat/task-27-workers

# Test AI endpoint
curl -X POST http://localhost:4000/api/v1/intake/ai-guidance \
  -H "Content-Type: application/json" \
  -d '{"tenantSlug":"demo","text":"Test"}'
```

---

## Problem? Quick Fixes

| Issue | Fix |
|-------|-----|
| "OpenAI API key error" | `grep OPENAI_API_KEY .env` - verify it's there |
| "Redis connection failed" | `docker-compose up -d redis` |
| "Database error" | `npx prisma db push` |
| "Type errors" | `npm run typecheck` then fix them |
| "Worker not processing" | Check BullMQ queue in Redis: `redis-cli` → `KEYS *` |
| "Stuck on code" | Schedule 30min pair with other engineer |

---

## Files You'll Edit

### BE#1 (Task #27)
```
src/server/services/queue/worker.ts          [MAIN FILE]
src/server/services/triage/engine.ts         [READ to understand]
src/server/services/systemic/detection-engine.ts [READ to understand]
```

### BE#2 (Task #28)
```
src/server/api/routes/intake.routes.ts       [EDIT - line 201]
src/server/api/routes/communication.routes.ts [EDIT - line 46]
src/server/services/ai/provider.ts           [EXTEND with methods]
src/server/services/ai/prompts.ts            [ADD new prompts]
```

---

## Week 1 Goals

**Mon-Wed:** Implement your task
**Thu:** Code review (swap with other engineer)
**Fri:** Testing + merge to main

**Done?** Ready for Week 2 (Tasks #29 & #32)

---

## Key Docs to Read

- [ ] PHASE_1_STARTUP_GUIDE.md (this week's plan)
- [ ] IMPROVEMENT_ROADMAP.md (big picture)
- [ ] Task #27 card (full description)
- [ ] Task #28 card (full description)

---

## Contact

- **Questions?** @ team-lead
- **Stuck on code?** Schedule 30min pair session
- **Daily standup:** 9 AM (set calendar reminder!)

---

**Remember:** This is parallel work. You CAN work independently Week 1.
If you need the other engineer, schedule the pairing - don't wait!

🚀 **Let's ship Phase 1!**
