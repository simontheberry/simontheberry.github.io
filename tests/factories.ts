import { v4 as uuid } from 'uuid';

// Factory: Create test tenant
export function createTestTenant(overrides = {}) {
  return {
    id: uuid(),
    name: 'Test Tenant',
    slug: 'test-tenant',
    domain: 'test.example.com',
    settings: {
      priorityWeights: {
        riskScore: 0.3,
        systemicImpact: 0.25,
        monetaryHarm: 0.15,
        vulnerabilityIndicator: 0.2,
        resolutionProbability: 0.1,
      },
      slaDefaults: {
        line1ResponseHours: 48,
        line2ResponseHours: 120,
        businessResponseDays: 14,
        escalationDays: 21,
      },
      autoSendEnabled: false,
      autoSendConfidenceThreshold: 0.85,
      supervisorReviewThreshold: 0.7,
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Factory: Create test user
export function createTestUser(tenantId: string, overrides = {}) {
  return {
    id: uuid(),
    tenantId,
    email: `user+${Date.now()}@example.com`,
    passwordHash: 'hashed_password',
    firstName: 'Test',
    lastName: 'User',
    role: 'complaint_officer',
    teamId: null,
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Factory: Create test complaint
export function createTestComplaint(tenantId: string, overrides = {}) {
  return {
    id: uuid(),
    tenantId,
    referenceNumber: `REF-${Date.now()}`,
    status: 'submitted',
    channel: 'portal',
    rawText: 'Test complaint text',
    summary: null,
    complainantFirstName: 'John',
    complainantLastName: 'Doe',
    complainantEmail: 'john@example.com',
    complainantPhone: null,
    complainantAddress: null,
    isVulnerable: false,
    vulnerabilityIndicators: null,
    businessId: null,
    category: null,
    legalCategory: null,
    industry: null,
    productService: null,
    monetaryValue: null,
    monetaryCurrency: 'AUD',
    incidentDate: null,
    submittedAt: new Date(),
    resolvedAt: null,
    slaDeadline: null,
    routingDestination: null,
    assignedToId: null,
    teamId: null,
    priorityScore: null,
    riskLevel: null,
    complexityScore: null,
    breachLikelihood: null,
    publicHarmIndicator: null,
    isCivilDispute: null,
    isSystemicRisk: false,
    systemicClusterId: null,
    embeddingId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Factory: Create test business
export function createTestBusiness(tenantId: string, overrides = {}) {
  return {
    id: uuid(),
    tenantId,
    name: 'Test Business',
    abn: '12345678901',
    entityName: 'Test Pty Ltd',
    entityType: 'COMPANY',
    entityStatus: 'ACTIVE',
    website: 'https://test.example.com',
    industry: 'retail',
    address: '123 Test St',
    phone: '1234567890',
    email: 'contact@test.example.com',
    isVerified: false,
    complaintCount: 0,
    avgRiskScore: null,
    repeatOffenderFlag: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Factory: Create test AI output
export function createTestAiOutput(complaintId: string, overrides = {}) {
  return {
    id: uuid(),
    complaintId,
    outputType: 'classification',
    model: 'gpt-4o',
    prompt: 'Test prompt',
    rawOutput: '{"category": "test"}',
    parsedOutput: { category: 'test' },
    confidence: 0.95,
    reasoning: 'Test reasoning',
    isEdited: false,
    editedBy: null,
    editedAt: null,
    tokenUsage: { prompt_tokens: 100, completion_tokens: 50 },
    latencyMs: 250,
    createdAt: new Date(),
    ...overrides,
  };
}

// Factory: Create test triage result
export function createTestTriageResult(overrides = {}) {
  return {
    category: 'misleading_conduct',
    legalCategory: 'consumer_protection',
    riskLevel: 'high',
    priorityScore: 0.78,
    complexityScore: 0.65,
    breachLikelihood: 0.85,
    publicHarmIndicator: 0.72,
    isCivilDispute: false,
    isSystemicRisk: true,
    routingDestination: 'line_2_investigation',
    summary: 'Test summary from AI',
    ...overrides,
  };
}

// Factory: Create mock AI response
export function createMockAiResponse(overrides = {}) {
  return {
    model: 'gpt-4o',
    confidence: 0.92,
    reasoning: 'Test reasoning',
    tokens: { prompt: 100, completion: 50 },
    latencyMs: 245,
    ...overrides,
  };
}

// Factory: Create mock embedding
export function createMockEmbedding(): number[] {
  return Array(1536)
    .fill(0)
    .map(() => Math.random());
}

// Factory: Create test audit log
export function createTestAuditLog(tenantId: string, userId: string, overrides = {}) {
  return {
    id: uuid(),
    tenantId,
    userId,
    action: 'complaint.created',
    entity: 'Complaint',
    entityId: uuid(),
    oldValues: null,
    newValues: { status: 'submitted' },
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    createdAt: new Date(),
    ...overrides,
  };
}
