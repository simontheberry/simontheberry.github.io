'use client';

import {
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../../components/providers/AuthProvider';
import { useApi } from '../../../components/hooks/useApi';
import { ComplaintQueueTable } from '../../../components/dashboard/ComplaintQueueTable';
import { StatsCard } from '../../../components/dashboard/StatsCard';

interface ComplaintListItem {
  id: string;
  referenceNumber: string;
  summary?: string;
  business?: string;
  category?: string;
  riskLevel?: string;
  priorityScore?: number;
  status: string;
  submittedAt?: string;
  slaDeadline?: string;
}

export default function OfficerDashboardPage() {
  const { user } = useAuth();

  // Fetch complaints assigned to current officer
  const { data: response, isLoading, error } = useApi<{
    data: ComplaintListItem[];
    meta: { page: number; pageSize: number; totalCount: number; totalPages: number };
  }>(`/api/v1/complaints?assignedTo=${user?.id || ''}&sortBy=priorityScore&sortOrder=desc&pageSize=100`);

  const complaints = response?.data || [];

  // Calculate stats from loaded data
  const stats = {
    assigned: complaints.length,
    inProgress: complaints.filter(c => c.status === 'in_progress').length,
    awaitingResponse: complaints.filter(c => c.status === 'awaiting_response').length,
    resolvedThisWeek: complaints.filter(c => c.status === 'resolved').length, // Would need date filtering for actual "this week"
  };
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gov-grey-900">My Queue</h1>
        <p className="mt-1 text-sm text-gov-grey-500">
          Complaints assigned to you, sorted by priority score.
        </p>
      </div>

      {/* Error State */}
      {error && (
        <div className="card bg-red-50 border border-red-200 p-4 mb-6">
          <p className="text-sm text-red-700">Failed to load your queue: {error}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard
          label="Assigned"
          value={isLoading ? '-' : stats.assigned}
          icon={<FileText className="h-5 w-5" />}
          color="blue"
        />
        <StatsCard
          label="In Progress"
          value={isLoading ? '-' : stats.inProgress}
          icon={<Clock className="h-5 w-5" />}
          color="yellow"
        />
        <StatsCard
          label="Awaiting Response"
          value={isLoading ? '-' : stats.awaitingResponse}
          icon={<AlertTriangle className="h-5 w-5" />}
          color="orange"
        />
        <StatsCard
          label="Resolved This Week"
          value={isLoading ? '-' : stats.resolvedThisWeek}
          icon={<CheckCircle2 className="h-5 w-5" />}
          color="green"
        />
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="card">
          <div className="p-8 text-center text-gov-grey-500">
            <p className="text-sm">Loading your queue...</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && complaints.length === 0 && (
        <div className="card">
          <div className="p-8 text-center text-gov-grey-500">
            <p className="text-sm">No complaints currently assigned to you.</p>
          </div>
        </div>
      )}

      {/* Queue Table */}
      {!isLoading && complaints.length > 0 && (
        <div className="card">
          <div className="p-4 border-b border-gov-grey-100 flex items-center justify-between">
            <h2 className="font-medium text-gov-grey-900">Priority Queue</h2>
            <div className="flex items-center gap-1.5 text-xs text-gov-grey-500">
              <Sparkles className="h-3.5 w-3.5" />
              Sorted by AI priority score
            </div>
          </div>
          <ComplaintQueueTable complaints={complaints} />
        </div>
      )}
    </div>
  );
}
