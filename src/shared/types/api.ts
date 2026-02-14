// ============================================================================
// API Request/Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: PaginationMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ComplaintFilters extends PaginationParams {
  status?: string;
  riskLevel?: string;
  category?: string;
  industry?: string;
  assignedTo?: string;
  routingDestination?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  minPriorityScore?: number;
}

export interface DashboardStats {
  totalComplaints: number;
  openComplaints: number;
  criticalComplaints: number;
  avgResolutionDays: number;
  complaintsToday: number;
  systemicAlerts: number;
  pendingTriage: number;
  slaBreaches: number;
}

export interface SystemicAlert {
  id: string;
  clusterId: string;
  title: string;
  description: string;
  complaintCount: number;
  industry: string;
  riskLevel: string;
  detectedAt: string;
  isAcknowledged: boolean;
}
