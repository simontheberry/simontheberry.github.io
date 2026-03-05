// ============================================================================
// User & Auth Types
// ============================================================================

export type UserRole = 'complaint_officer' | 'supervisor' | 'executive' | 'admin' | 'system';

export interface User {
  id: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  teamId?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokenPayload {
  userId: string;
  tenantId: string;
  role: UserRole;
  email: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  settings: TenantSettings;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TenantSettings {
  priorityWeights: {
    riskScore: number;
    systemicImpact: number;
    monetaryHarm: number;
    vulnerabilityIndicator: number;
    resolutionProbability: number;
  };
  slaDefaults: {
    line1ResponseHours: number;
    line2ResponseHours: number;
    businessResponseDays: number;
    escalationDays: number;
  };
  autoSendEnabled: boolean;
  aiProvider: 'openai' | 'anthropic' | 'azure_openai' | 'custom';
  features: {
    emailIngestion: boolean;
    webhookIntake: boolean;
    publicPortal: boolean;
    autoResponse: boolean;
    systemicDetection: boolean;
  };
}
