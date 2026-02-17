// ============================================================================
// Team Coordination Framework - Continuous Optimization
// ============================================================================

## Objective
Ensure the team is always working on **highest-value activities** through regular sync,
identify blockers early, and pivot when better opportunities emerge.

---

## Weekly Team Sync (Every Friday)

### Agenda (30 min)

#### 1. Status Update (5 min)
Each team member reports:
- **Completed this week:** What shipped
- **Blocked/Risks:** Any impediments
- **Confidence:** On track for commitments?

#### 2. Enhancement Opportunities (15 min)
Team identifies high-value work NOT currently planned:

**Questions to ask:**
- What would have the biggest impact on user experience?
- What's preventing us from shipping faster?
- What technical debt is slowing us down?
- Are there quick wins we missed?
- What did we learn this week that changes priorities?

**Opportunity categories:**
- 🚀 **Force Multipliers** (makes future work faster)
- 🔒 **Security/Compliance** (risk mitigation)
- 📊 **Performance** (user experience)
- 🐛 **Bug Fixes** (stability)
- 🎯 **UX Improvements** (adoption)
- 📚 **Documentation** (knowledge transfer)
- 🧪 **Testing** (confidence)

#### 3. Reprioritization Discussion (8 min)
**Evaluation criteria for current tasks vs opportunities:**

| Factor | Weight | Scoring |
|--------|--------|---------|
| **Business Impact** | 30% | Low (1) → High (5) |
| **User Impact** | 25% | Low (1) → High (5) |
| **Effort** | 20% | High effort (1) → Low effort (5) |
| **Blocker Status** | 15% | Unblocks 5+ tasks (5) → No blocker (1) |
| **Technical Debt** | 10% | High debt (5) → Low debt (1) |

**Decision:** If opportunity scores > current task, reprioritize.

#### 4. Assignments for Next Week (2 min)
- Confirm commitments
- Assign any new opportunities
- Identify any shifting priorities

---

## Between-Sync Communication

### Daily Standup (5-10 min)
**For Backend/Frontend/Lead only during active sprints:**
- Morning: What's today's goal?
- Afternoon: Any blockers?

### Slack/Async Updates
When team members discover enhancement opportunities:
1. **Post in #work-channel:** Brief description + estimated effort
2. **Tag relevant expert:** E.g., @ai-engineer for AI improvements
3. **Add to "Opportunities Board"** (see below)
4. **Wait for Friday sync** to formally discuss (unless blocking critical path)

**Exception:** If blocker affects shipping, escalate immediately to lead.

---

## Opportunities Board (GitHub Discussions or Trello)

Track all potential enhancements between syncs:

```
TEMPLATE FOR EACH OPPORTUNITY:

Title: [Brief description]
Category: 🚀 Force Multiplier / 🔒 Security / 📊 Performance / etc.
Effort: 1-2 days / 2-3 days / Week+ / Unknown
Impact: High / Medium / Low
Discovered by: [Name]
Details: [Why this matters]
Score: [Calculated at Friday sync]
Status: Pending Discussion / Approved / Deferred / In Progress
Assigned to: [After Friday sync]
```

**Example:**
```
Title: Add caching to pgvector similarity search
Category: 📊 Performance
Effort: 1-2 days
Impact: High (search queries 50% slower with current implementation)
Discovered by: Backend Engineer
Details: Systemic detection queries on large datasets are slow.
         Adding Redis cache on embeddings could help.
Score: [Calculated Friday]
Status: Pending Discussion
```

---

## Reprioritization Triggers

**Immediately escalate to Lead if:**
- ⚠️ Critical bug blocks team (security, data loss, deployment)
- 🚫 External deadline changes
- 📋 Customer/stakeholder request with urgency
- 🤝 Blocker preventing 2+ team members from working

**Can wait until Friday sync if:**
- ✅ Enhancement improves existing feature
- 📚 Documentation or tech debt item
- 🧪 Testing or quality improvement
- 🎯 Medium-term UX improvement

---

## Current Phase 2 Opportunities Board

### Identified Opportunities (TBD at Friday syncs)

| Opportunity | Category | Effort | Impact | Owner | Status |
|-------------|----------|--------|--------|-------|--------|
| [To be filled in during syncs] | | | | | |

---

## Reprioritization Examples

### Example 1: Discovery During Testing
**Scenario:** AI Engineer finds that confidence scores are unreliable

```
Opportunity: Recalibrate AI confidence scoring
Category: 🚀 Force Multiplier (affects all downstream decisions)
Effort: 2-3 days
Impact: High (confidence used in SLA routing, auto-send decisions)

Friday Sync Decision:
- Current priority: Task #38 (internal notes - medium impact)
- Opportunity: Fix confidence scoring (high impact, blocksAI reliability)
- Decision: PIVOT - AI Engineer works on calibration instead
- Reassign: #38 deferred to following week
```

### Example 2: Quick Win During Code Review
**Scenario:** Security Officer notices RBAC gap in new endpoints

```
Opportunity: Add RBAC check to evidence upload endpoint
Category: 🔒 Security
Effort: < 1 day
Impact: High (production risk)

Friday Sync Decision:
- Current priority: #34 tests (3 days remaining)
- Opportunity: Fix RBAC gap (< 1 day, high security impact)
- Decision: REPRIORITIZE - Security Officer fixes gap immediately
- Plan: Backend Engineer supports if needed
```

### Example 3: Technical Debt
**Scenario:** Performance profiling shows slow queries

```
Opportunity: Optimize complaint list query (N+1 problem)
Category: 📊 Performance
Effort: 1-2 days
Impact: Medium (improves dashboard load time by 2 seconds)

Friday Sync Decision:
- Current priority: #37 audit logging (2-3 days remaining)
- Opportunity: Query optimization (1-2 days, medium impact)
- Decision: DEFER - Finish #37 first, start optimization Week 2
- Rationale: Audit logging is critical path for compliance
```

---

## Metrics to Track

### Weekly Report (Auto-generated for Friday sync)

```
PHASE 2 WEEK [N] SUMMARY

Completed:
- [Task]: [Owner], [Days taken]
- [Task]: [Owner], [Days taken]

In Progress:
- [Task]: [Owner], [Days remaining]

Blockers:
- [Blocker]: [Severity], [Owner], [Mitigation]

Opportunities Discussed:
- [Opportunity]: [Score], [Decision]

Reprioritizations:
- [From Task X to Task Y], [Reason]

Next Week Commitments:
- [Task assignments]

Quality Metrics:
- TypeScript errors: [Count]
- Test coverage: [%]
- Code review time: [Avg hours]
```

---

## Team Member Responsibilities

### Backend Engineer
- Monitor for database/API performance opportunities
- Identify technical debt in server code
- Suggest optimizations during code review

### Frontend Engineer
- Track UI/UX improvement opportunities
- Monitor component performance
- Identify testing gaps

### AI Engineer
- Experiment with prompt improvements
- Identify confidence scoring issues
- Suggest embedding model optimizations

### Security Officer
- Continuous security scanning for gaps
- Identify compliance/audit opportunities
- Review RBAC across all new endpoints

### Lead
- Facilitate Friday syncs
- Make final prioritization decisions
- Escalate external blockers
- Ensure no one is idle

---

## Reprioritization Decision Tree

```
QUESTION 1: Is it a blocker?
  YES → Escalate immediately to Lead
  NO → Continue

QUESTION 2: Does it enable faster shipping?
  YES → Score vs current task
  NO → Continue

QUESTION 3: Is it high-value + low-effort?
  YES → Strong candidate for immediate pivot
  NO → Continue

QUESTION 4: Is current task near completion?
  YES → Defer to after current task
  NO → Continue

QUESTION 5: Is current task in critical path?
  YES → Defer opportunity
  NO → Evaluate for immediate start

RESULT: Schedule for Friday sync discussion
```

---

## Implementation Checklist

- [ ] Schedule Friday 5 PM weekly sync (30 min)
- [ ] Create Opportunities Board (GitHub Discussions)
- [ ] Post this framework in team wiki
- [ ] First sync: Discuss any Phase 2 opportunities discovered
- [ ] Second sync: Evaluate AI calibration, RBAC, performance
- [ ] Third sync: Full retrospective + Phase 3 planning

---

## Expected Outcomes

✅ **No idle team members** - Opportunities fill gaps
✅ **Faster shipping** - Force multipliers identified early
✅ **Better quality** - Security/performance continuously reviewed
✅ **Team alignment** - Everyone knows why priorities changed
✅ **Learning culture** - Discoveries inform future planning

---

**First Team Sync:** Friday 5 PM (start Phase 2 Week 1)
**Opportunities:** Report any discoveries to #work-channel anytime
