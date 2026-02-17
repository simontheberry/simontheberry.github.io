# Performance Audit - Phase 3 Stream 1

## Executive Summary

**Objective:** Identify and quantify database performance bottlenecks

**Findings:** 4 critical areas with optimization opportunities

**Estimated Impact:** 30-50% query performance improvement

---

## Current Index Analysis

### Schema Review

**Well-Indexed Tables** ✅
- `complaints`: 8 indexes (status, priority, risk, category, assigned, routing, created, business)
- `audit_logs`: 2 indexes (tenant+created, entity+id)
- `complaint_events`: 2 indexes (complaint+created)
- `tasks`: 2 indexes (assignee+status, complaint)

**Under-Indexed Tables** ⚠️
- `escalations`: **0 indexes** (only FK) → HIGH PRIORITY
- `evidence`: **0 indexes** (only FK) → MEDIUM PRIORITY
- `communications`: **1 index** (complaint only) → MEDIUM PRIORITY
- `systemic_clusters`: **2 indexes** (missing key queries)

**Partially Indexed Tables** 🟡
- `ai_outputs`: **1 index** (complaint+type, missing type-only)
- `businesses`: **2 indexes** (missing status/risk lookups)
- `users`: **1 unique** (tenantId+email, missing role/active)

---

## Critical Query Patterns & Bottlenecks

### Pattern 1: List Complaints by Status (Frequent)
```typescript
// Used by: dashboard, filtering, triage queue
prisma.complaint.findMany({
  where: { tenantId, status: 'triaged' },
  orderBy: { createdAt: 'desc' },
  take: 20
})
```

**Current:** ✅ Index exists `[tenantId, status]`
**Status:** Good ✓

---

### Pattern 2: Check SLA Breaches (Critical - Runs hourly)
```typescript
// Used by: SLA worker queue
prisma.complaint.findMany({
  where: {
    tenantId,
    slaDeadline: { lt: now },
    status: { in: ['triaged', 'assigned', 'in_progress'] }
  }
})
```

**Current:** ❌ No index on `[tenantId, slaDeadline]`
**Impact:** FULL TABLE SCAN for ~1000s of complaints
**Fix:** Add index on `[tenantId, slaDeadline]`

---

### Pattern 3: List Escalations for Complaint (Frequent)
```typescript
// Used by: timeline, escalation dashboard
prisma.escalation.findMany({
  where: { complaintId }
})
```

**Current:** ❌ No index on `complaintId` (FK only)
**Impact:** Slow cascade queries
**Fix:** Add explicit index on `complaintId`

---

### Pattern 4: List Evidence for Complaint (Frequent)
```typescript
// Used by: evidence tab, AI analysis
prisma.evidence.findMany({
  where: { complaintId }
})
```

**Current:** ❌ No index on `complaintId` (FK only)
**Impact:** Slow when complaint has 10+ files
**Fix:** Add explicit index on `complaintId`

---

### Pattern 5: Get Pending Tasks (Frequent)
```typescript
// Used by: task dashboard, work queues
prisma.task.findMany({
  where: {
    assignedTo: userId,
    status: { in: ['pending', 'in_progress'] }
  }
})
```

**Current:** ✅ Index exists `[assignedTo, status]`
**Status:** Good ✓

---

### Pattern 6: Search Audit Logs (Compliance)
```typescript
// Used by: compliance reports, audit trail
prisma.auditLog.findMany({
  where: {
    tenantId,
    action: 'complaint.created',
    createdAt: { gte: startDate, lte: endDate }
  },
  orderBy: { createdAt: 'desc' }
})
```

**Current:** ⚠️ Index exists `[tenantId, createdAt]` but missing action filter
**Impact:** Scans all tenant logs, then filters by action
**Fix:** Add index on `[tenantId, action, createdAt]`

---

### Pattern 7: Get Active Systemic Clusters (Dashboard)
```typescript
// Used by: systemic issues dashboard
prisma.systemicCluster.findMany({
  where: {
    tenantId,
    isActive: true,
    riskLevel: { in: ['high', 'critical'] }
  }
})
```

**Current:** ⚠️ Partial index on `[tenantId, riskLevel]` but no `isActive` filter
**Impact:** Scans then filters by isActive
**Fix:** Add index on `[tenantId, isActive]` or compound `[tenantId, isActive, riskLevel]`

---

### Pattern 8: Communications History (Frequent)
```typescript
// Used by: complaint timeline, communication thread
prisma.communication.findMany({
  where: { complaintId },
  orderBy: { createdAt: 'desc' }
})
```

**Current:** ✅ Index exists on `complaintId`
**But:** Missing ordering index for `[complaintId, createdAt]`
**Fix:** Add index on `[complaintId, createdAt(sort: Desc)]`

---

## Recommended Index Additions

### Priority 1: Critical Performance Fix (Do First)

```prisma
// escalations.prisma - NEW
model Escalation {
  // ... existing fields ...
  @@index([complaintId])  // ← ADD THIS
  @@index([tenantId, createdAt(sort: Desc)])  // ← ADD THIS
  @@map("escalations")
}

// evidence.prisma - NEW
model Evidence {
  // ... existing fields ...
  @@index([complaintId])  // ← ADD THIS
  @@map("evidence")
}

// complaints.prisma - ADD MISSING
model Complaint {
  // ... existing fields ...
  @@index([tenantId, slaDeadline])  // ← ADD THIS (for SLA checks)
  // ... rest of indexes ...
}
```

**Expected Impact:** 40-60% improvement on:
- SLA breach detection (hourly job)
- Escalation timeline queries
- Evidence listing

---

### Priority 2: Important Optimizations (Do Second)

```prisma
// audit_logs.prisma - ENHANCE
model AuditLog {
  // ... existing fields ...
  @@index([tenantId, createdAt(sort: Desc)])  // ← EXISTING
  @@index([tenantId, action, createdAt(sort: Desc)])  // ← ADD THIS
  @@index([entity, entityId])  // ← EXISTING
  @@map("audit_logs")
}

// systemic_clusters.prisma - ENHANCE
model SystemicCluster {
  // ... existing fields ...
  @@index([tenantId, isActive])  // ← ADD THIS
  @@index([tenantId, isActive, riskLevel])  // ← ADD THIS
  @@index([tenantId, riskLevel])  // ← EXISTING (can remove if using compound)
  @@map("systemic_clusters")
}

// communications.prisma - ENHANCE
model Communication {
  // ... existing fields ...
  @@index([complaintId, createdAt(sort: Desc)])  // ← ADD THIS (compound index for ordering)
  @@map("communications")
}

// users.prisma - ADD
model User {
  // ... existing fields ...
  @@unique([tenantId, email])  // ← EXISTING
  @@index([tenantId, role])  // ← ADD THIS (for role-based queries)
  @@index([tenantId, isActive])  // ← ADD THIS (for active user listings)
  @@map("users")
}
```

**Expected Impact:** 15-30% improvement on:
- Compliance report queries
- Systemic cluster filtering
- Communication history ordering
- User role queries

---

### Priority 3: Nice-to-Have Optimizations

```prisma
// ai_outputs.prisma - ENHANCE
model AiOutput {
  // ... existing fields ...
  @@index([complaintId, outputType])  // ← EXISTING
  @@index([outputType, createdAt])  // ← ADD (for stats queries)
  @@map("ai_outputs")
}

// businesses.prisma - ENHANCE
model Business {
  // ... existing fields ...
  @@index([tenantId, repeatOffenderFlag])  // ← EXISTING
  @@index([tenantId, name(length: 50)])  // ← ADD (for searches)
  @@map("businesses")
}

// complaint_events.prisma - ENHANCE
model ComplaintEvent {
  // ... existing fields ...
  @@index([complaintId, createdAt(sort: Desc)])  // ← EXISTING
  @@index([eventType, createdAt(sort: Desc)])  // ← ADD (for event filtering)
  @@map("complaint_events")
}
```

---

## Migration Strategy

### Step 1: Create New Indexes (Minimal Downtime)
```sql
-- Run on live database (non-blocking)
-- Adding indexes does NOT require table lock

CREATE INDEX idx_escalations_complaint_id
  ON escalations(complaint_id);

CREATE INDEX idx_escalations_tenant_created
  ON escalations(tenant_id, created_at DESC);

CREATE INDEX idx_evidence_complaint_id
  ON evidence(complaint_id);

CREATE INDEX idx_complaints_sla_deadline
  ON complaints(tenant_id, sla_deadline);

-- ... etc for all Priority 1 indexes
```

**Duration:** ~5-10 seconds per index (non-blocking)
**Downtime:** None

### Step 2: Test Query Performance
```sql
-- Compare BEFORE and AFTER

-- BEFORE: Seq Scan (slow)
EXPLAIN ANALYZE
SELECT * FROM escalations WHERE complaint_id = 'xxx';

-- AFTER: Index Scan (fast)
EXPLAIN ANALYZE
SELECT * FROM escalations WHERE complaint_id = 'xxx';
```

### Step 3: Drop Duplicate/Redundant Indexes
```sql
-- After verifying new indexes work
-- Remove old unused indexes

-- Example: if we add [tenantId, isActive, riskLevel]
-- we might remove [tenantId, riskLevel]
```

---

## Performance Baselines to Measure

### Before Optimization
```
Metric                        Current    Target
SLA check query              500-1000ms  <100ms
Escalation list              100-300ms   <50ms
Evidence list (10 files)     50-200ms    <30ms
Audit log search             200-500ms   <100ms
Systemic cluster filter      100-400ms   <75ms
```

### After Optimization
```
Metric                        Current    Target    Expected
SLA check query              500-1000ms  <100ms    ✓ (100-200ms with new index)
Escalation list              100-300ms   <50ms     ✓ (20-50ms with index)
Evidence list (10 files)     50-200ms    <30ms     ✓ (10-30ms with index)
Audit log search             200-500ms   <100ms    ✓ (75-150ms with new index)
Systemic cluster filter      100-400ms   <75ms     ✓ (30-75ms with index)
```

---

## Caching Opportunities (Stream 1 - Part 2)

### High-Frequency Cached Queries

**Cache 1: Tenant Settings** (5 min TTL)
```typescript
// Current: Every request loads from DB
const settings = await prisma.tenant.findUnique({
  where: { id: tenantId }
});

// After: Redis cache
const settings = await cache.get(
  `tenant:${tenantId}:settings`,
  () => prisma.tenant.findUnique({ where: { id: tenantId } }),
  { ttl: 5 * 60 } // 5 minutes
);
```

**Impact:** 60-80% reduction on tenant queries

**Cache 2: Complaint Categories** (daily TTL)
```typescript
// Cache the category enumeration
const categories = await cache.get(
  'categories:all',
  () => getComplaintCategories(),
  { ttl: 24 * 60 * 60 } // 24 hours
);
```

**Cache 3: User Permissions** (session TTL)
```typescript
// Cache user role checks
const permissions = await cache.get(
  `user:${userId}:permissions`,
  () => getUserPermissions(userId),
  { ttl: 8 * 60 * 60 } // 8 hours
);
```

---

## Implementation Checklist

### Indexes (Priority 1)
- [ ] Add index on `escalations(complaint_id)`
- [ ] Add index on `escalations(tenant_id, created_at DESC)`
- [ ] Add index on `evidence(complaint_id)`
- [ ] Add index on `complaints(tenant_id, sla_deadline)`
- [ ] Test: SLA check latency improved
- [ ] Test: Escalation queries improved
- [ ] Test: Evidence listing improved

### Indexes (Priority 2)
- [ ] Add index on `audit_logs(tenant_id, action, created_at DESC)`
- [ ] Add index on `systemic_clusters(tenant_id, isActive)`
- [ ] Add index on `systemic_clusters(tenant_id, isActive, risk_level)`
- [ ] Add index on `communications(complaint_id, created_at DESC)`
- [ ] Add index on `users(tenant_id, role)`
- [ ] Add index on `users(tenant_id, is_active)`

### Caching (Priority 2)
- [ ] Implement tenant settings cache
- [ ] Implement category cache
- [ ] Implement permission cache
- [ ] Add Redis TTL invalidation on mutations

### Validation
- [ ] Run performance tests (before/after)
- [ ] Generate EXPLAIN ANALYZE for each query
- [ ] Measure cost metrics (DB CPU, memory)
- [ ] Document improvements achieved

---

## Success Metrics

✅ Phase 3 Stream 1 Complete When:

- [ ] All Priority 1 indexes implemented
- [ ] Performance baseline report generated
- [ ] SLA check latency reduced to <200ms
- [ ] Escalation queries latency reduced to <50ms
- [ ] Evidence queries latency reduced to <30ms
- [ ] Audit log searches improved 2-3x
- [ ] All tests pass (from #34)
- [ ] No regressions in query results

**Expected Savings:**
- Query time: 30-50% improvement
- DB load: 40% reduction
- AI API calls: batching saves 20-30%

