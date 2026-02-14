# AI Complaint Triage Platform — Architecture Document

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        INTERNET / PUBLIC                            │
├─────────────┬──────────────────┬────────────────────────────────────┤
│  Complaint  │  Regulator       │  External Systems                  │
│  Portal     │  Dashboard       │  (Email, Webhooks, ABR)            │
│  (Next.js)  │  (Next.js)       │                                    │
└──────┬──────┴────────┬─────────┴──────────┬─────────────────────────┘
       │               │                    │
       ▼               ▼                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     API GATEWAY (Express.js)                        │
│  ┌─────────┐ ┌──────────┐ ┌───────────┐ ┌────────┐ ┌────────────┐ │
│  │  Auth   │ │  Tenant  │ │  Rate     │ │ Audit  │ │  CORS/     │ │
│  │  MW     │ │  Resolver│ │  Limiter  │ │ Logger │ │  Helmet    │ │
│  └─────────┘ └──────────┘ └───────────┘ └────────┘ └────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│                         API ROUTES                                  │
│  /intake  /complaints  /triage  /dashboard  /systemic  /comms      │
├──────────────────────────┬──────────────────────────────────────────┤
│      SERVICE LAYER       │           AI LAYER                       │
│  ┌────────────────────┐  │  ┌─────────────────────────────────┐    │
│  │ Triage Engine      │  │  │  AI Provider Abstraction        │    │
│  │ Priority Calculator│  │  │  ┌───────────┐ ┌────────────┐  │    │
│  │ ABN Lookup         │  │  │  │  OpenAI   │ │ Anthropic  │  │    │
│  │ Line 1 Handler     │  │  │  └───────────┘ └────────────┘  │    │
│  │ Systemic Detection │  │  │                                 │    │
│  │ Email Ingestion    │  │  │  Pipelines:                     │    │
│  └────────────────────┘  │  │  - Extraction                   │    │
│                          │  │  - Classification                │    │
│  ┌────────────────────┐  │  │  - Risk Scoring                 │    │
│  │ BullMQ Workers     │  │  │  - Summarisation                │    │
│  │ - Triage           │  │  │  - Draft Generation             │    │
│  │ - Systemic         │  │  │  - Clustering Analysis          │    │
│  │ - SLA Monitor      │  │  │  - Embedding Generation         │    │
│  │ - Email Send       │  │  └─────────────────────────────────┘    │
│  └────────────────────┘  │                                          │
├──────────────────────────┴──────────────────────────────────────────┤
│                       DATA LAYER                                    │
│  ┌──────────────────┐  ┌──────────┐  ┌──────────────────────────┐  │
│  │  PostgreSQL +    │  │  Redis   │  │  File Storage            │  │
│  │  pgvector        │  │  Queue + │  │  (Local / S3)            │  │
│  │  (Prisma ORM)    │  │  Cache   │  │                          │  │
│  └──────────────────┘  └──────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## 2. Folder Structure

```
complaint-triage-platform/
├── prisma/
│   └── schema.prisma              # Database schema
├── docker/
│   └── Dockerfile                 # Multi-stage production build
├── docker-compose.yml             # Dev environment orchestration
├── docs/
│   └── ARCHITECTURE.md            # This document
├── src/
│   ├── shared/                    # Shared between client & server
│   │   ├── types/
│   │   │   ├── complaint.ts       # Complaint domain types
│   │   │   ├── user.ts            # User & auth types
│   │   │   └── api.ts             # API request/response types
│   │   ├── constants/
│   │   │   └── categories.ts      # Shared enums & labels
│   │   └── utils/
│   ├── server/                    # Backend (Express.js)
│   │   ├── index.ts               # Server entry point
│   │   ├── config/
│   │   │   └── index.ts           # Environment config with Zod
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── index.ts       # Route aggregator
│   │   │   │   ├── auth.routes.ts
│   │   │   │   ├── intake.routes.ts
│   │   │   │   ├── complaint.routes.ts
│   │   │   │   ├── triage.routes.ts
│   │   │   │   ├── dashboard.routes.ts
│   │   │   │   ├── business.routes.ts
│   │   │   │   ├── systemic.routes.ts
│   │   │   │   └── communication.routes.ts
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── error-handler.ts
│   │   │   │   ├── request-logger.ts
│   │   │   │   └── tenant-resolver.ts
│   │   │   └── controllers/
│   │   │   └── validators/
│   │   ├── services/
│   │   │   ├── ai/
│   │   │   │   ├── provider.ts        # LLM abstraction layer
│   │   │   │   ├── prompts.ts         # All prompt templates
│   │   │   │   └── ai-service.ts      # Orchestrator
│   │   │   ├── triage/
│   │   │   │   ├── triage-engine.ts   # Full triage pipeline
│   │   │   │   └── priority-calculator.ts
│   │   │   ├── enrichment/
│   │   │   │   └── abn-lookup.ts      # ABR integration
│   │   │   ├── systemic/
│   │   │   │   └── detection-engine.ts
│   │   │   ├── communications/
│   │   │   │   └── line1-handler.ts
│   │   │   └── queue/
│   │   │       └── worker.ts          # BullMQ job processors
│   │   ├── db/
│   │   │   ├── migrations/
│   │   │   └── seeds/
│   │   └── utils/
│   │       └── logger.ts
│   └── client/                    # Frontend (Next.js)
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx               # Landing page
│       │   ├── complaint-form/
│       │   │   └── page.tsx           # Public complaint form
│       │   └── dashboard/
│       │       ├── layout.tsx         # Dashboard shell
│       │       ├── officer/page.tsx
│       │       ├── supervisor/page.tsx
│       │       ├── executive/page.tsx
│       │       ├── complaints/page.tsx
│       │       ├── systemic/page.tsx
│       │       └── settings/page.tsx
│       ├── components/
│       │   ├── forms/
│       │   │   ├── ComplaintTextInput.tsx
│       │   │   ├── AiGuidancePanel.tsx
│       │   │   ├── BusinessLookup.tsx
│       │   │   ├── ComplainantDetailsForm.tsx
│       │   │   └── ReviewSubmit.tsx
│       │   ├── dashboard/
│       │   │   ├── StatsCard.tsx
│       │   │   └── ComplaintQueueTable.tsx
│       │   └── layout/
│       │       └── DashboardLayout.tsx
│       ├── styles/
│       │   └── globals.css
│       ├── hooks/
│       ├── services/
│       ├── store/
│       └── types/
└── package.json
```

## 3. Database Schema

### Entity Relationship Summary

- **Tenant** → Users, Complaints, Businesses, SystemicClusters (multi-tenant root)
- **User** → AssignedComplaints, AuditLogs, Tasks
- **Complaint** → Business, Evidence, AiOutputs, Communications, Tasks, Escalations, Timeline Events
- **Business** → Complaints (aggregated stats, repeat offender tracking)
- **SystemicCluster** → Complaints (grouping)
- **AuditLog** → Tenant, User (full traceability)
- **ComplaintEmbedding** → pgvector column for similarity search

Key indexes are on: `(tenant_id, status)`, `(tenant_id, priority_score DESC)`,
`(tenant_id, risk_level)`, `(tenant_id, created_at DESC)`, and `(business_id)`.

## 4. API Endpoints

### Public Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/login` | Authenticate user |
| POST | `/api/v1/auth/refresh` | Refresh JWT token |
| POST | `/api/v1/intake/submit` | Submit complaint via portal |
| POST | `/api/v1/intake/ai-guidance` | Get AI guidance during intake |
| POST | `/api/v1/intake/webhook` | Receive external complaints |
| GET | `/api/v1/businesses/search` | Search ABR for business |

### Protected Endpoints (require JWT)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/complaints` | List complaints (filtered, paginated) |
| GET | `/api/v1/complaints/:id` | Get complaint detail |
| PATCH | `/api/v1/complaints/:id` | Update complaint |
| POST | `/api/v1/complaints/:id/assign` | Assign to officer |
| POST | `/api/v1/complaints/:id/escalate` | Escalate complaint |
| GET | `/api/v1/complaints/:id/timeline` | Get event timeline |
| GET | `/api/v1/complaints/:id/similar` | Find similar complaints |
| POST | `/api/v1/triage/:id` | Trigger triage |
| POST | `/api/v1/triage/:id/override` | Override triage result |
| GET | `/api/v1/triage/:id/result` | Get triage result |
| GET | `/api/v1/dashboard/stats` | Overview statistics |
| GET | `/api/v1/dashboard/officer` | Officer queue |
| GET | `/api/v1/dashboard/supervisor` | Team overview |
| GET | `/api/v1/dashboard/executive` | Executive overview |
| GET | `/api/v1/dashboard/trends` | Complaint trends |
| GET | `/api/v1/systemic/clusters` | List systemic clusters |
| GET | `/api/v1/systemic/clusters/:id` | Cluster detail |
| POST | `/api/v1/systemic/clusters/:id/acknowledge` | Acknowledge alert |
| GET | `/api/v1/systemic/alerts` | Active alerts |
| GET | `/api/v1/systemic/heatmap` | Industry heat map |
| GET | `/api/v1/systemic/repeat-offenders` | Repeat offender list |
| POST | `/api/v1/communications/draft` | Generate AI draft |
| POST | `/api/v1/communications/send` | Send communication |
| GET | `/api/v1/communications/templates` | List templates |

## 5. Complaint Lifecycle Walkthrough

### Example: Consumer submits complaint about misleading loan pricing

**Step 1: Intake**
1. Consumer visits `/complaint-form`
2. Enters free-text description of the issue
3. AI guidance panel activates:
   - Detects business name "National Finance Group"
   - Identifies category: `misleading_conduct`
   - Flags missing: incident date, monetary value
   - Asks: "When did you first notice the pricing discrepancy?"
4. Consumer provides additional details
5. Business Lookup: searches ABR, returns ABN, entity details
6. Consumer confirms verified business details
7. Consumer enters contact details and submits

**Step 2: Triage (Background)**
1. BullMQ job queued: `complaint-triage`
2. AI Extraction: Pulls structured data from narrative
3. AI Classification:
   - Primary: `misleading_conduct`
   - Legal: ACL s18 — Misleading or deceptive conduct
   - Breach likelihood: 0.82
   - Civil dispute: No
   - Systemic risk: flagged (similar pattern detected)
4. AI Risk Scoring:
   - Risk level: `critical`
   - Complexity: 0.71
   - Public harm: 0.85
5. Priority Score calculated: **0.92**
6. Routing: `line_2_investigation` (high risk + complexity)
7. AI Summary generated
8. Complaint status → `triaged`

**Step 3: Systemic Detection (Background)**
1. Embedding generated and stored
2. pgvector similarity search finds 13 similar complaints
3. Cluster analysis confirms systemic pattern
4. SystemicCluster record created/updated
5. Alert generated for supervisors

**Step 4: Assignment**
1. Complaint appears in officer's priority queue (position #1 due to score 0.92)
2. Supervisor assigns to senior officer based on workload
3. Officer sees: AI summary, risk assessment, similar complaints, recommended actions

**Step 5: Investigation**
1. Officer reviews complaint details and AI analysis
2. Generates AI-drafted business notice (request for response)
3. Reviews and approves draft → sent to business
4. Status → `awaiting_response`
5. SLA clock starts (14 days for business response)

**Step 6: Resolution or Escalation**
- If business responds adequately → resolve
- If no response within SLA → auto-escalation
- If systemic pattern confirmed → enforcement referral candidate

## 6. Priority Score Formula

```
Priority Score =
  (Risk Score × w₁) +
  (Systemic Impact × w₂) +
  (Monetary Harm × w₃) +
  (Vulnerability Indicator × w₄) +
  ((1 - Resolution Probability) × w₅)
```

Default weights (configurable per tenant):

| Factor | Weight | Description |
|--------|--------|-------------|
| Risk Score | 0.30 | AI-assessed risk level (0-1) |
| Systemic Impact | 0.25 | Industry-wide harm potential |
| Monetary Harm | 0.15 | Log-normalized financial impact |
| Vulnerability | 0.20 | Consumer vulnerability indicators |
| Resolution Probability | 0.10 | Inverted: lower self-resolution = higher priority |

## 7. Security & Governance

- **Authentication**: JWT with configurable expiry
- **Authorization**: Role-based (complaint_officer, supervisor, executive, admin)
- **Multi-tenancy**: Tenant isolation via tenant_id on all data queries
- **Audit logging**: All state changes, AI outputs, and user actions logged
- **AI traceability**: Every AI output stored with prompt, raw output, confidence, model used
- **Encryption**: HTTPS enforced; database encryption at rest via PostgreSQL
- **Auto-send controls**: Configurable per tenant; disabled by default
- **Prompt logging**: All prompts sent to LLMs are stored and auditable
- **Data isolation**: Row-level tenant filtering; no cross-tenant data leakage

## 8. MVP Roadmap

### Phase 1 — Core Platform (MVP)
- Public complaint submission portal with AI-guided intake
- Business ABR auto-enrichment
- AI triage pipeline (extraction, classification, risk scoring, summarisation)
- Priority-scored complaint queue (officer dashboard)
- Basic RBAC and authentication
- PostgreSQL + Redis infrastructure
- Docker deployment

### Phase 2 — Workflow & Communications
- Line 1 AI-drafted responses with human approval
- Business notice generation
- SLA monitoring and auto-escalation
- Email ingestion (IMAP listener)
- Webhook intake for external systems
- Communication templates
- Supervisor dashboard (team workload, SLA compliance)

### Phase 3 — Systemic Intelligence
- pgvector embedding storage and similarity search
- Systemic clustering engine
- Spike anomaly detection
- Industry heat maps
- Repeat offender tracking
- Executive dashboard with enforcement candidates
- Emerging issue alerting

### Future Enhancements
- Real-time collaboration on complaint review
- Document OCR and AI evidence analysis
- Predictive analytics (complaint volume forecasting)
- Integration with court/tribunal filing systems
- Consumer portal for tracking complaint status
- Multi-language support
- Mobile-optimised regulator interface
- API marketplace for third-party regulator tools
- Federated learning across tenants (privacy-preserving)
- Advanced NLP for contract clause analysis
