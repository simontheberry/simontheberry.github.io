# Phase 2: Next Task Assignments

## Current Status
✅ Task #30 - Settings endpoint (Backend + Frontend complete)
✅ Task #31 - SMTP email sending (Backend complete)
✅ Task #33 - SLA calculation & escalation (Backend complete with metrics)

## Recommended Next Tasks

### Backend Engineer: Task #35 - Communication Templates CRUD
**Effort:** 2-3 days | **Priority:** MEDIUM

Implement CRUD operations for reusable communication templates.

**Endpoints to build:**
```
GET    /api/v1/settings/templates             - List all active templates
POST   /api/v1/settings/templates             - Create new template (admin/supervisor)
GET    /api/v1/settings/templates/:id         - Get single template
PATCH  /api/v1/settings/templates/:id         - Update template (admin/supervisor)
DELETE /api/v1/settings/templates/:id         - Delete template (admin only)
POST   /api/v1/settings/templates/:id/preview - Preview with variables interpolated
```

**What to implement:**
- Zod validation for template fields (name, type, subject, body, variables)
- Variable interpolation support ({{complainantName}}, {{businessName}}, {{complaintId}}, etc.)
- RBAC: Templates are tenant-specific, list only active
- Three template types: response_to_complainant, notice_to_business, escalation_notice
- Audit logging on all mutations
- Soft delete support (isActive flag)

**Database ready:** CommunicationTemplate table already in schema

**Unblocks:** Task #31 enhancement (auto-draft from templates instead of AI)

---

### Frontend Engineer: Task #34 - Comprehensive Test Suite
**Effort:** 3-4 days | **Priority:** HIGH

Build unit and integration tests for all Phase 1/2 work.

**What to test:**
```
Tests needed:
- TriageEngine: Input → triage output, weight calculations
- SystemicDetectionEngine: Embeddings, similarity search, spike detection
- Settings endpoints: GET, PATCH, reset, validation
- Communication routes: Draft, send, templates
- SLA calculations: Deadline calculation, breach detection
- Worker jobs: processTriageJob, processSystemicDetection, processSlaCheck
- Dashboard endpoints: Officer, supervisor, executive views
- Auth: Login, JWT validation, RBAC enforcement
```

**Setup:**
- vitest.config.ts with path aliases
- test database for integration tests
- Mock AI responses
- Factory functions for test data
- Coverage target: >80%

**Unblocks:** Phase 3 (confident shipping)

---

### Frontend Engineer (Alternative): Task #36 - Evidence/Attachment Upload
**Effort:** 3-4 days | **Priority:** MEDIUM

Implement file upload for complaints.

**Endpoints to build:**
```
POST   /api/v1/complaints/:id/evidence        - Upload file(s)
GET    /api/v1/complaints/:id/evidence        - List attachments
DELETE /api/v1/evidence/:id                   - Delete attachment
```

**What to implement:**
- File picker UI (drag-drop + click)
- Progress indicator for uploads
- File type/size validation
- Storage abstraction (local dev, S3 production)
- Virus scan integration (optional, Phase 3)
- Evidence table already in schema

---

## Team Coordination

**If splitting tests:**
- Backend Engineer: Worker tests, engine tests, API tests
- Frontend Engineer: Component tests, hook tests, integration tests

**If doing full test suite together:**
- Backend Engineer starts with engine/worker tests
- Frontend Engineer starts with component tests
- Collaborate on integration tests

**Recommendation:** 
Start with #35 (Templates) for backend engineer - completes communication pipeline and is self-contained
Assign #34 (Tests) to frontend engineer - ensures coverage and quality

---

**Timeline:**
- Today-Tomorrow: #35 (Backend)
- Parallel: #34 (Frontend, 3-4 days)
- By end of week: Both complete, Phase 2 at 60% done

Ready to start? Confirm your assignments!
