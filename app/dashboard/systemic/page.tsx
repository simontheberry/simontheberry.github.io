'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  Activity,
  TrendingUp,
  Eye,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { StatsCard } from '../../../components/dashboard/StatsCard';
import { useApi, useApiMutation } from '../../../components/hooks/useApi';

interface SystemicCluster {
  clusterId: string;
  title: string;
  riskLevel: string;
  complaintCount: number;
  detectedAt: string;
}

interface ClusterDetail {
  id: string;
  title: string;
  description: string | null;
  industry: string | null;
  category: string | null;
  riskLevel: string;
  complaintCount: number;
  avgSimilarity: number | null;
  commonPatterns: string[];
  affectedBusinesses: Array<{ id: string; name: string; complaintCount: number }>;
  complaints: Array<{ id: string; referenceNumber: string; summary: string; riskLevel: string }>;
  aiAnalysis: {
    confidence: number | null;
    reasoning: string | null;
    recommendedAction: string | null;
    estimatedConsumerHarm: string | null;
  } | null;
  isAcknowledged: boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  detectedAt: string;
}

export default function SystemicIssuesPage() {
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);

  // Fetch all active clusters (includes both acknowledged and unacknowledged)
  const { data: alertsData, isLoading: alertsLoading, error: alertsError, refetch: refetchAlerts } = useApi<SystemicCluster[]>(
    '/api/v1/systemic/alerts',
  );

  const { data: clustersData, isLoading: clustersLoading } = useApi<Array<{
    id: string;
    title: string;
    description: string | null;
    industry: string | null;
    category: string | null;
    riskLevel: string;
    complaintCount: number;
    avgSimilarity: number | null;
    commonPatterns: string[];
    affectedBusinesses: string[];
    isAcknowledged: boolean;
    detectedAt: string;
  }>>('/api/v1/systemic/clusters');

  // Fetch detail for expanded cluster
  const { data: clusterDetail, isLoading: detailLoading } = useApi<ClusterDetail>(
    expandedCluster ? `/api/v1/systemic/clusters/${expandedCluster}` : null,
  );

  const { mutate: acknowledge, isLoading: ackLoading } = useApiMutation<void>();

  const clusters = clustersData ?? [];
  const isLoading = alertsLoading || clustersLoading;
  const error = alertsError;

  // Calculate stats from live data
  const activeClusters = clusters.length;
  const unacknowledged = clusters.filter(c => !c.isAcknowledged).length;
  const totalComplaints = clusters.reduce((sum, c) => sum + c.complaintCount, 0);
  const industriesAffected = new Set(clusters.map(c => c.industry).filter(Boolean)).size;

  const handleAcknowledge = async (clusterId: string) => {
    await acknowledge(`/api/v1/systemic/clusters/${clusterId}/acknowledge`, 'POST');
    refetchAlerts();
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gov-grey-900">Systemic Issue Detection</h1>
        <p className="mt-1 text-sm text-gov-grey-500">
          AI-detected clusters of related complaints indicating potential systemic consumer harm.
        </p>
      </div>

      {/* Error State */}
      {error && (
        <div className="card bg-red-50 border border-red-200 p-4 mb-6">
          <p className="text-sm text-red-700">Failed to load systemic data: {error}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard
          label="Active Clusters"
          value={isLoading ? '-' : activeClusters}
          icon={<Activity className="h-5 w-5" />}
          color="red"
        />
        <StatsCard
          label="Unacknowledged"
          value={isLoading ? '-' : unacknowledged}
          icon={<AlertTriangle className="h-5 w-5" />}
          color="orange"
        />
        <StatsCard
          label="Total Complaints in Clusters"
          value={isLoading ? '-' : totalComplaints}
          icon={<TrendingUp className="h-5 w-5" />}
          color="blue"
        />
        <StatsCard
          label="Industries Affected"
          value={isLoading ? '-' : industriesAffected}
          icon={<Eye className="h-5 w-5" />}
          color="yellow"
        />
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="card">
          <div className="p-8 text-center text-gov-grey-500">
            <p className="text-sm">Loading systemic clusters...</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && clusters.length === 0 && (
        <div className="card">
          <div className="p-8 text-center text-gov-grey-500">
            <p className="text-sm">No active systemic clusters detected.</p>
          </div>
        </div>
      )}

      {/* Cluster Cards */}
      {!isLoading && clusters.length > 0 && (
        <div className="space-y-4">
          {clusters.map((cluster) => {
            const isExpanded = expandedCluster === cluster.id;
            const detail = isExpanded ? clusterDetail : null;

            return (
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
                      {cluster.description && (
                        <p className="text-sm text-gov-grey-600">{cluster.description}</p>
                      )}

                      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gov-grey-500">
                        <span>{cluster.complaintCount} complaints</span>
                        {cluster.industry && <span>{cluster.industry}</span>}
                        {cluster.avgSimilarity != null && (
                          <span>{(cluster.avgSimilarity * 100).toFixed(0)}% avg similarity</span>
                        )}
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

                      {/* Expanded Detail */}
                      {isExpanded && detailLoading && (
                        <div className="mt-4 flex items-center gap-2 text-sm text-gov-grey-500">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading detail...
                        </div>
                      )}

                      {isExpanded && detail && (
                        <div className="mt-4 border-t border-gov-grey-100 pt-4 space-y-4">
                          {/* Affected Businesses */}
                          {detail.affectedBusinesses.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-gov-grey-500 uppercase tracking-wide mb-2">
                                Affected Businesses
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {detail.affectedBusinesses.map((biz) => (
                                  <span
                                    key={biz.id}
                                    className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs text-red-700"
                                  >
                                    {biz.name} ({biz.complaintCount})
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* AI Analysis */}
                          {detail.aiAnalysis && (
                            <div className="bg-gov-grey-50 rounded-lg p-3">
                              <p className="text-xs font-medium text-gov-grey-500 uppercase tracking-wide mb-1">
                                AI Analysis
                              </p>
                              {detail.aiAnalysis.reasoning && (
                                <p className="text-sm text-gov-grey-700">{detail.aiAnalysis.reasoning}</p>
                              )}
                              <div className="mt-2 flex gap-4 text-xs text-gov-grey-500">
                                {detail.aiAnalysis.confidence != null && (
                                  <span>Confidence: {(detail.aiAnalysis.confidence * 100).toFixed(0)}%</span>
                                )}
                                {detail.aiAnalysis.recommendedAction && (
                                  <span>Recommended: {detail.aiAnalysis.recommendedAction.replace(/_/g, ' ')}</span>
                                )}
                                {detail.aiAnalysis.estimatedConsumerHarm && (
                                  <span>Estimated harm: {detail.aiAnalysis.estimatedConsumerHarm}</span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Member Complaints */}
                          {detail.complaints.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-gov-grey-500 uppercase tracking-wide mb-2">
                                Related Complaints ({detail.complaints.length})
                              </p>
                              <div className="space-y-1">
                                {detail.complaints.slice(0, 10).map((c) => (
                                  <div
                                    key={c.id}
                                    className="flex items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-gov-grey-50"
                                  >
                                    <span className="font-mono text-gov-grey-500">{c.referenceNumber}</span>
                                    <span className="flex-1 mx-3 text-gov-grey-700 truncate">{c.summary}</span>
                                    <span className={`badge badge-${c.riskLevel} text-[10px]`}>{c.riskLevel}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="ml-4 flex flex-col gap-2">
                      {!cluster.isAcknowledged && (
                        <button
                          onClick={() => handleAcknowledge(cluster.id)}
                          disabled={ackLoading}
                          className="btn-primary text-xs"
                        >
                          {ackLoading ? 'Saving...' : 'Acknowledge'}
                        </button>
                      )}
                      <button
                        onClick={() => setExpandedCluster(isExpanded ? null : cluster.id)}
                        className="btn-secondary text-xs"
                      >
                        {isExpanded ? 'Collapse' : 'View Complaints'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
