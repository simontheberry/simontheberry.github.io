'use client';

import {
  AlertTriangle,
  Activity,
  TrendingUp,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import { StatsCard } from '../../../components/dashboard/StatsCard';
import { StatsCardSkeleton, ErrorState } from '../../../components/dashboard/LoadingSkeleton';
import { useApi, useApiMutation } from '../../../components/hooks/useApi';

interface SystemicCluster {
  id: string;
  title: string;
  description: string;
  industry: string;
  category: string;
  riskLevel: string;
  complaintCount: number;
  avgSimilarity: number;
  commonPatterns: string[];
  isAcknowledged: boolean;
  detectedAt: string;
}

export default function SystemicIssuesPage() {
  const { data, isLoading, error, refetch } = useApi<SystemicCluster[]>(
    '/api/v1/systemic/clusters'
  );
  const { mutate, isLoading: isAcknowledging } = useApiMutation<void>();

  const clusters = data ?? [];
  const unacknowledged = clusters.filter((c) => !c.isAcknowledged);
  const totalComplaints = clusters.reduce((sum, c) => sum + c.complaintCount, 0);
  const uniqueIndustries = new Set(clusters.map((c) => c.industry)).size;

  async function handleAcknowledge(clusterId: string) {
    await mutate(`/api/v1/systemic/clusters/${clusterId}/acknowledge`, 'POST');
    refetch();
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gov-grey-900">Systemic Issue Detection</h1>
        <p className="mt-1 text-sm text-gov-grey-500">
          AI-detected clusters of related complaints indicating potential systemic consumer harm.
        </p>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <>
          {/* Stats */}
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
                <StatsCard label="Active Clusters" value={clusters.length} icon={<Activity className="h-5 w-5" />} color="red" />
                <StatsCard label="Unacknowledged" value={unacknowledged.length} icon={<AlertTriangle className="h-5 w-5" />} color="orange" />
                <StatsCard label="Total Complaints in Clusters" value={totalComplaints} icon={<TrendingUp className="h-5 w-5" />} color="blue" />
                <StatsCard label="Industries Affected" value={uniqueIndustries} icon={<Eye className="h-5 w-5" />} color="yellow" />
              </>
            )}
          </div>

          {/* Cluster Cards */}
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="card p-5 animate-pulse">
                  <div className="h-5 w-64 bg-gov-grey-200 rounded mb-3" />
                  <div className="h-4 w-full bg-gov-grey-100 rounded mb-2" />
                  <div className="h-4 w-3/4 bg-gov-grey-100 rounded" />
                </div>
              ))}
            </div>
          ) : clusters.length === 0 ? (
            <div className="card p-12 text-center text-sm text-gov-grey-400">
              No systemic clusters detected.
            </div>
          ) : (
            <div className="space-y-4">
              {clusters.map((cluster) => (
                <div key={cluster.id} className="card">
                  <div className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle
                            className={`h-5 w-5 ${
                              cluster.riskLevel === 'critical' ? 'text-red-500' : 'text-orange-500'
                            }`}
                          />
                          <h3 className="text-base font-semibold text-gov-grey-900">{cluster.title}</h3>
                          <span className={`badge badge-${cluster.riskLevel}`}>
                            {cluster.riskLevel}
                          </span>
                          {cluster.isAcknowledged && (
                            <span className="badge bg-gov-grey-100 text-gov-grey-600">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Acknowledged
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gov-grey-600">{cluster.description}</p>

                        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gov-grey-500">
                          <span>{cluster.complaintCount} complaints</span>
                          <span>{cluster.industry}</span>
                          <span>{(cluster.avgSimilarity * 100).toFixed(0)}% avg similarity</span>
                          <span>Detected {new Date(cluster.detectedAt).toLocaleDateString()}</span>
                        </div>

                        {/* Common Patterns */}
                        {cluster.commonPatterns.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs font-medium text-gov-grey-500 uppercase tracking-wide mb-1">
                              Common Patterns
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {cluster.commonPatterns.map((pattern) => (
                                <span
                                  key={pattern}
                                  className="inline-flex items-center rounded-md bg-gov-grey-100 px-2 py-1 text-xs text-gov-grey-700"
                                >
                                  {pattern}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="ml-4 flex flex-col gap-2">
                        {!cluster.isAcknowledged && (
                          <button
                            className="btn-primary text-xs"
                            onClick={() => handleAcknowledge(cluster.id)}
                            disabled={isAcknowledging}
                          >
                            Acknowledge
                          </button>
                        )}
                        <button className="btn-secondary text-xs">
                          View Complaints
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
