'use client';

import {
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { ComplaintQueueTable } from '../../../components/dashboard/ComplaintQueueTable';
import { StatsCard } from '../../../components/dashboard/StatsCard';
import { StatsCardSkeleton, QueueTableSkeleton, ErrorState } from '../../../components/dashboard/LoadingSkeleton';
import { useApi } from '../../../components/hooks/useApi';

interface OfficerQueueComplaint {
  id: string;
  referenceNumber: string;
  summary: string;
  business: string;
  category: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  priorityScore: number;
  status: string;
  submittedAt: string;
  slaDeadline: string;
}

interface OfficerDashboardData {
  queue: OfficerQueueComplaint[];
  stats: {
    assigned: number;
    inProgress: number;
    awaitingResponse: number;
    resolvedThisWeek: number;
  };
}

export default function OfficerDashboardPage() {
  const { data, isLoading, error, refetch } = useApi<OfficerDashboardData>('/api/v1/dashboard/officer');

  const stats = data?.stats;
  const queue = data?.queue ?? [];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gov-grey-900">My Queue</h1>
        <p className="mt-1 text-sm text-gov-grey-500">
          Complaints assigned to you, sorted by priority score.
        </p>
      </div>

      {/* Stats */}
      {error ? (
        <div className="mb-8">
          <ErrorState message={error} onRetry={refetch} />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {isLoading ? (
            <>
              <StatsCardSkeleton />
              <StatsCardSkeleton />
              <StatsCardSkeleton />
              <StatsCardSkeleton />
            </>
          ) : (
            <>
              <StatsCard
                label="Assigned"
                value={stats?.assigned ?? 0}
                icon={<FileText className="h-5 w-5" />}
                color="blue"
              />
              <StatsCard
                label="In Progress"
                value={stats?.inProgress ?? 0}
                icon={<Clock className="h-5 w-5" />}
                color="yellow"
              />
              <StatsCard
                label="Awaiting Response"
                value={stats?.awaitingResponse ?? 0}
                icon={<AlertTriangle className="h-5 w-5" />}
                color="orange"
              />
              <StatsCard
                label="Resolved This Week"
                value={stats?.resolvedThisWeek ?? 0}
                icon={<CheckCircle2 className="h-5 w-5" />}
                color="green"
              />
            </>
          )}
        </div>
      )}

      {/* Queue Table */}
      <div className="card">
        <div className="p-4 border-b border-gov-grey-100 flex items-center justify-between">
          <h2 className="font-medium text-gov-grey-900">Priority Queue</h2>
          <div className="flex items-center gap-1.5 text-xs text-gov-grey-500">
            <Sparkles className="h-3.5 w-3.5" />
            Sorted by AI priority score
          </div>
        </div>
        {isLoading ? (
          <QueueTableSkeleton />
        ) : error ? null : (
          <ComplaintQueueTable complaints={queue} />
        )}
      </div>
    </div>
  );
}
