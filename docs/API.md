# API Reference

Base URL: `http://localhost:4000/api/v1`

All responses follow the format:

```json
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "pageSize": 20, "totalCount": 100, "totalPages": 5 }
}
```

Error responses:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": { "email": ["Invalid email format"] }
  }
}
```

---

## Authentication

### Login

```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "officer@regulator.gov.au",
    "password": "password",
    "tenantSlug": "default"
  }'
```

Response:

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "demo-user-id",
      "email": "officer@regulator.gov.au",
      "firstName": "Demo",
      "lastName": "User",
      "role": "complaint_officer",
      "tenantId": "demo-tenant-id"
    }
  }
}
```

Use the token in subsequent requests:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Refresh Token

```bash
curl -X POST http://localhost:4000/api/v1/auth/refresh \
  -H "Authorization: Bearer $TOKEN"
```

---

## Public Endpoints (No Auth Required)

### Submit a Complaint

`POST /api/v1/intake/submit`

```bash
curl -X POST http://localhost:4000/api/v1/intake/submit \
  -H "Content-Type: application/json" \
  -d '{
    "tenantSlug": "default",
    "complainant": {
      "firstName": "Jane",
      "lastName": "Smith",
      "email": "jane.smith@example.com",
      "phone": "0412345678",
      "address": {
        "street": "42 Wallaby Way",
        "suburb": "Sydney",
        "state": "NSW",
        "postcode": "2000"
      }
    },
    "business": {
      "name": "Acme Financial Services Pty Ltd",
      "abn": "12345678901",
      "website": "https://acmefinance.com.au",
      "industry": "financial_services"
    },
    "complaint": {
      "rawText": "I applied for a personal loan with Acme Financial Services. They advertised a comparison rate of 5.99% p.a. but after signing, I discovered hidden fees that bring the effective rate to 8.2%. I have been overcharged approximately $3,400 over 12 months. I have contacted them three times and they refuse to adjust the charges. I have copies of the original advertisement and my loan contract.",
      "category": "misleading_conduct",
      "productService": "Personal loan",
      "monetaryValue": 3400,
      "incidentDate": "2024-06-15"
    }
  }'
```

Response:

```json
{
  "success": true,
  "data": {
    "referenceNumber": "CMP-M2X9F1-A3B4",
    "message": "Your complaint has been received and will be reviewed. You will receive updates at the email address provided."
  }
}
```

### Get AI Guidance During Complaint Entry

`POST /api/v1/intake/ai-guidance`

Send the user's current text to get AI analysis of what's missing.

```bash
curl -X POST http://localhost:4000/api/v1/intake/ai-guidance \
  -H "Content-Type: application/json" \
  -d '{
    "tenantSlug": "default",
    "text": "I bought a second-hand car from a dealership in Melbourne. They told me it had never been in an accident but I later found out it had been written off and repaired. The car is now having mechanical issues that I believe are related to the undisclosed accident damage.",
    "currentData": {}
  }'
```

Response:

```json
{
  "success": true,
  "data": {
    "extractedData": {
      "businessName": "Dealership in Melbourne",
      "category": "misleading_conduct",
      "monetaryValue": null,
      "incidentDate": null
    },
    "missingFields": [
      {
        "field": "businessName",
        "importance": "critical",
        "question": "What is the name of the car dealership?"
      },
      {
        "field": "monetaryValue",
        "importance": "important",
        "question": "How much did you pay for the car?"
      },
      {
        "field": "incidentDate",
        "importance": "important",
        "question": "When did you purchase the vehicle?"
      }
    ],
    "followUpQuestions": [],
    "completenessScore": 0.4,
    "confidence": 0.7
  }
}
```

### Receive Complaint via Webhook

`POST /api/v1/intake/webhook`

For integrating with existing regulator form systems.

```bash
curl -X POST http://localhost:4000/api/v1/intake/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "source": "legacy-webform",
    "tenantApiKey": "tenant-api-key-here",
    "payload": {
      "name": "John Doe",
      "email": "john@example.com",
      "complaint": "Overcharged on energy bill",
      "business": "PowerCo"
    }
  }'
```

---

## Business Search (ABR Lookup)

### Search by Name

`GET /api/v1/businesses/search?name=<query>`

```bash
curl "http://localhost:4000/api/v1/businesses/search?name=Telstra"
```

### Search by ABN

`GET /api/v1/businesses/search?abn=<abn>`

```bash
curl "http://localhost:4000/api/v1/businesses/search?abn=33051775556"
```

Response:

```json
{
  "success": true,
  "data": {
    "abn": "33051775556",
    "entityName": "TELSTRA GROUP LIMITED",
    "entityType": "Australian Public Company",
    "entityStatus": "Active",
    "isCurrentIndicator": true,
    "businessNames": ["Telstra"],
    "state": "VIC",
    "postcode": "3000"
  }
}
```

> Requires `ABR_API_GUID` to be set in `.env`. Register at https://abr.business.gov.au/Tools/WebServices

---

## Complaints (Protected)

All complaint endpoints require `Authorization: Bearer <token>` and `x-tenant-id` headers.

### List Complaints

`GET /api/v1/complaints`

Query parameters:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `pageSize` | number | 20 | Results per page (max 100) |
| `sortBy` | string | `priorityScore` | Sort field |
| `sortOrder` | `asc` \| `desc` | `desc` | Sort direction |
| `status` | string | — | Filter by status |
| `riskLevel` | string | — | Filter by risk level: `low`, `medium`, `high`, `critical` |
| `category` | string | — | Filter by complaint category |
| `industry` | string | — | Filter by industry |
| `assignedTo` | string | — | Filter by assigned officer ID |
| `routingDestination` | string | — | `line_1_auto`, `line_2_investigation`, `systemic_review` |
| `dateFrom` | string | — | ISO date string |
| `dateTo` | string | — | ISO date string |
| `search` | string | — | Free-text search |
| `minPriorityScore` | number | — | Minimum priority score (0-1) |

```bash
# Get critical complaints sorted by priority
curl "http://localhost:4000/api/v1/complaints?riskLevel=critical&sortBy=priorityScore&sortOrder=desc" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: demo-tenant-id"

# Search for complaints mentioning "loan"
curl "http://localhost:4000/api/v1/complaints?search=loan&pageSize=10" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: demo-tenant-id"

# Get all complaints routed to Line 2 investigation
curl "http://localhost:4000/api/v1/complaints?routingDestination=line_2_investigation" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: demo-tenant-id"
```

### Get Complaint Detail

`GET /api/v1/complaints/:id`

```bash
curl http://localhost:4000/api/v1/complaints/COMPLAINT_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: demo-tenant-id"
```

### Update Complaint

`PATCH /api/v1/complaints/:id`

```bash
curl -X PATCH http://localhost:4000/api/v1/complaints/COMPLAINT_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: demo-tenant-id" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_progress",
    "riskLevel": "high"
  }'
```

### Assign Complaint to Officer

`POST /api/v1/complaints/:id/assign`

Requires `supervisor` or `admin` role.

```bash
curl -X POST http://localhost:4000/api/v1/complaints/COMPLAINT_ID/assign \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: demo-tenant-id" \
  -H "Content-Type: application/json" \
  -d '{ "assigneeId": "USER_ID" }'
```

### Escalate Complaint

`POST /api/v1/complaints/:id/escalate`

```bash
curl -X POST http://localhost:4000/api/v1/complaints/COMPLAINT_ID/escalate \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: demo-tenant-id" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Business non-responsive past SLA deadline",
    "destination": "line_2_investigation"
  }'
```

### Get Complaint Timeline

`GET /api/v1/complaints/:id/timeline`

```bash
curl http://localhost:4000/api/v1/complaints/COMPLAINT_ID/timeline \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: demo-tenant-id"
```

### Find Similar Complaints

`GET /api/v1/complaints/:id/similar`

Uses pgvector embedding similarity search.

```bash
curl http://localhost:4000/api/v1/complaints/COMPLAINT_ID/similar \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: demo-tenant-id"
```

---

## Triage (Protected)

### Trigger Triage

`POST /api/v1/triage/:complaintId`

Queues the complaint for AI triage processing.

```bash
curl -X POST http://localhost:4000/api/v1/triage/COMPLAINT_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: demo-tenant-id"
```

### Override Triage Result

`POST /api/v1/triage/:complaintId/override`

Requires `supervisor` or `admin` role.

```bash
curl -X POST http://localhost:4000/api/v1/triage/COMPLAINT_ID/override \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: demo-tenant-id" \
  -H "Content-Type: application/json" \
  -d '{
    "riskLevel": "critical",
    "routingDestination": "line_2_investigation",
    "priorityScore": 0.95,
    "reason": "Manual override: additional evidence received indicating systemic breach"
  }'
```

### Get Triage Result

`GET /api/v1/triage/:complaintId/result`

```bash
curl http://localhost:4000/api/v1/triage/COMPLAINT_ID/result \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: demo-tenant-id"
```

---

## Dashboard (Protected)

### Overview Statistics

`GET /api/v1/dashboard/stats`

```bash
curl http://localhost:4000/api/v1/dashboard/stats \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: demo-tenant-id"
```

### Officer Queue

`GET /api/v1/dashboard/officer`

Returns the authenticated officer's personal complaint queue sorted by priority.

```bash
curl http://localhost:4000/api/v1/dashboard/officer \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: demo-tenant-id"
```

### Supervisor Overview

`GET /api/v1/dashboard/supervisor`

```bash
curl http://localhost:4000/api/v1/dashboard/supervisor \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: demo-tenant-id"
```

### Executive Overview

`GET /api/v1/dashboard/executive`

```bash
curl http://localhost:4000/api/v1/dashboard/executive \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: demo-tenant-id"
```

### Complaint Trends

`GET /api/v1/dashboard/trends`

| Param | Default | Description |
|-------|---------|-------------|
| `period` | `30d` | Time period: `7d`, `30d`, `90d`, `1y` |
| `groupBy` | `day` | Grouping: `day`, `week`, `month` |

```bash
curl "http://localhost:4000/api/v1/dashboard/trends?period=90d&groupBy=week" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: demo-tenant-id"
```

---

## Systemic Issues (Protected)

### List Active Clusters

`GET /api/v1/systemic/clusters`

```bash
curl http://localhost:4000/api/v1/systemic/clusters \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: demo-tenant-id"
```

### Get Cluster Detail

`GET /api/v1/systemic/clusters/:id`

```bash
curl http://localhost:4000/api/v1/systemic/clusters/CLUSTER_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: demo-tenant-id"
```

### Acknowledge Systemic Alert

`POST /api/v1/systemic/clusters/:id/acknowledge`

Requires `supervisor`, `executive`, or `admin` role.

```bash
curl -X POST http://localhost:4000/api/v1/systemic/clusters/CLUSTER_ID/acknowledge \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: demo-tenant-id"
```

### Active Alerts

`GET /api/v1/systemic/alerts`

Returns unacknowledged systemic clusters above threshold.

```bash
curl http://localhost:4000/api/v1/systemic/alerts \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: demo-tenant-id"
```

### Industry Heat Map

`GET /api/v1/systemic/heatmap`

```bash
curl http://localhost:4000/api/v1/systemic/heatmap \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: demo-tenant-id"
```

### Repeat Offenders

`GET /api/v1/systemic/repeat-offenders`

```bash
curl http://localhost:4000/api/v1/systemic/repeat-offenders \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: demo-tenant-id"
```

---

## Communications (Protected)

### Generate AI Draft

`POST /api/v1/communications/draft`

```bash
curl -X POST http://localhost:4000/api/v1/communications/draft \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: demo-tenant-id" \
  -H "Content-Type: application/json" \
  -d '{
    "complaintId": "COMPLAINT_UUID",
    "type": "response_to_complainant"
  }'
```

Type options: `response_to_complainant`, `notice_to_business`, `escalation_notice`

### Approve and Send

`POST /api/v1/communications/send`

```bash
curl -X POST http://localhost:4000/api/v1/communications/send \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: demo-tenant-id" \
  -H "Content-Type: application/json" \
  -d '{ "communicationId": "COMMUNICATION_UUID" }'
```

### List Templates

`GET /api/v1/communications/templates`

```bash
curl http://localhost:4000/api/v1/communications/templates \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: demo-tenant-id"
```

---

## Health Check (No Auth)

```bash
curl http://localhost:4000/health
```

Response:

```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request body or query params failed Zod validation |
| `TENANT_REQUIRED` | 400 | Missing `x-tenant-id` header on protected endpoint |
| `UNAUTHORIZED` | 401 | No token provided |
| `INVALID_TOKEN` | 401 | Token expired or invalid |
| `FORBIDDEN` | 403 | User role does not have permission for this action |
| `NOT_FOUND` | 404 | Resource not found |
| `ABN_LOOKUP_FAILED` | 500 | ABR API request failed |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Role Permissions

| Endpoint | complaint_officer | supervisor | executive | admin |
|----------|:-:|:-:|:-:|:-:|
| List/view complaints | Y | Y | Y | Y |
| Update complaints | Y | Y | — | Y |
| Assign complaints | — | Y | — | Y |
| Escalate complaints | Y | Y | — | Y |
| Trigger triage | Y | Y | — | Y |
| Override triage | — | Y | — | Y |
| Officer dashboard | Y | Y | — | Y |
| Supervisor dashboard | — | Y | — | Y |
| Executive dashboard | — | — | Y | Y |
| Acknowledge systemic alert | — | Y | Y | Y |
| Settings | — | — | — | Y |
