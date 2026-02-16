'use client';

import {
  AlertTriangle,
  Building2,
  Scale,
  BarChart3,
  ArrowUpRight,
} from 'lucide-react';
import { StatsCard } from '../../../components/dashboard/StatsCard';
import { StatsCardSkeleton, ErrorState } from '../../../components/dashboard/LoadingSkeleton';
import { useApi } from '../../../components/hooks/useApi';

interface IndustryRisk {
  industry: string;
  complaints: number;
  avgRisk: number;
  systemicClusters: number;
  trend: 'up' | 'down' | 'stable';
}

interface RepeatOffender {
  name: string;
  complaints: number;
  avgRisk: number;
  industry: string;
}

interface EnforcementCandidate {
  business: string;
  reason: string;
  complaintCount: number;
  avgRisk: number;
}

interface ExecutiveDashboardData {
  industryRiskMap: IndustryRisk[];
  emergingRisks: unknown[];
  enforcementCandidates: EnforcementCandidate[];
  repeatOffenderIndex: RepeatOffender[];
  complaintVolumeTrend: unknown[];
}

export default function ExecutiveDashboardPage() {
  const { data, isLoading, error, refetch } = useApi<ExecutiveDashboardData>(
    '/api/v1/dashboard/executive'
  );

  const industryRiskMap = data?.industryRiskMap ?? [];
  const repeatOffenderIndex = data?.repeatOffenderIndex ?? [];
  const enforcementCandidates = data?.enforcementCandidates ?? [];

  const totalComplaints = industryRiskMap.reduce((sum, r) => sum + r.complaints, 0);
  const totalSystemicClusters = industryRiskMap.reduce((sum, r) => sum + r.systemicClusters, 0);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gov-grey-900">Executive Overview</h1>
        <p className="mt-1 text-sm text-gov-grey-500">
          Industry risk landscape, enforcement candidates, and emerging conduct risks.
        </p>
      </div>

      {error ? (
        <div className="mb-8">
          <ErrorState message={error} onRetry={refetch} />
        </div>
      ) : (
        <>
          {/* Top-Level Stats */}
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
                  label="Total Complaints"
                  value={totalComplaints}
                  icon={<BarChart3 className="h-5 w-5" />}
                  color="blue"
                />
                <StatsCard
                  label="Systemic Clusters"
                  value={totalSystemicClusters}
                  icon={<AlertTriangle className="h-5 w-5" />}
                  color="red"
                />
                <StatsCard
                  label="Repeat Offenders"
                  value={repeatOffenderIndex.length}
                  icon={<Building2 className="h-5 w-5" />}
                  color="orange"
                />
                <StatsCard
                  label="Enforcement Candidates"
                  value={enforcementCandidates.length}
                  icon={<Scale className="h-5 w-5" />}
                  color="red"
                />
              </>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Industry Risk Map */}
            <div className="card">
              <div className="p-4 border-b border-gov-grey-100">
                <h2 className="font-medium text-gov-grey-900">Industry Risk Map</h2>
              </div>
              {isLoading ? (
                <div className="p-8 text-center text-sm text-gov-grey-400 animate-pulse">Loading...</div>
              ) : industryRiskMap.length === 0 ? (
                <div className="p-8 text-center text-sm text-gov-grey-400">No industry data available.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gov-grey-100">
                        <th className="px-4 py-3 text-left text-xs font-medium text-gov-grey-500 uppercase">Industry</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gov-grey-500 uppercase">Complaints</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gov-grey-500 uppercase">Avg Risk</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gov-grey-500 uppercase">Systemic</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gov-grey-500 uppercase">Trend</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gov-grey-100">
                      {industryRiskMap.map((row) => (
                        <tr key={row.industry} className="hover:bg-gov-grey-50">
                          <td className="px-4 py-3 text-sm font-medium text-gov-grey-900">{row.industry}</td>
                          <td className="px-4 py-3 text-sm">{row.complaints}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-2 rounded-full bg-gov-grey-200">
                                <div
                                  className="h-2 rounded-full"
                                  style={{
                                    width: `${row.avgRisk * 100}%`,
                                    backgroundColor: row.avgRisk > 0.7 ? '#ef4444' : row.avgRisk > 0.5 ? '#f59e0b' : '#22c55e',
                                  }}
                                />
                              </div>
                              <span className="text-xs font-mono">{(row.avgRisk * 100).toFixed(0)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm">{row.systemicClusters}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium ${
                              row.trend === 'up' ? 'text-red-600' : row.trend === 'down' ? 'text-green-600' : 'text-gov-grey-500'
                            }`}>
                              {row.trend === 'up' ? 'Rising' : row.trend === 'down' ? 'Declining' : 'Stable'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Repeat Offender Index */}
            <div className="card">
              <div className="p-4 border-b border-gov-grey-100">
                <h2 className="font-medium text-gov-grey-900">Repeat Offender Index</h2>
              </div>
              <div className="p-4 space-y-3">
                {isLoading ? (
                  <div className="text-center text-sm text-gov-grey-400 animate-pulse py-4">Loading...</div>
                ) : repeatOffenderIndex.length === 0 ? (
                  <div className="text-center text-sm text-gov-grey-400 py-4">No repeat offenders identified.</div>
                ) : (
                  repeatOffenderIndex.map((offender, i) => (
                    <div key={offender.name} className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gov-grey-100 text-xs font-medium text-gov-grey-600">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gov-grey-900 truncate">{offender.name}</p>
                        <p className="text-xs text-gov-grey-500">
                          {offender.complaints} complaints &middot; {offender.industry}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-sm font-mono font-medium ${
                            offender.avgRisk > 0.7 ? 'text-red-600' : 'text-yellow-600'
                          }`}
                        >
                          {(offender.avgRisk * 100).toFixed(0)}
                        </span>
                        <p className="text-xs text-gov-grey-400">risk</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Enforcement Candidates */}
          <div className="card">
            <div className="p-4 border-b border-gov-grey-100">
              <h2 className="font-medium text-gov-grey-900">Enforcement Referral Candidates</h2>
            </div>
            {isLoading ? (
              <div className="p-8 text-center text-sm text-gov-grey-400 animate-pulse">Loading...</div>
            ) : enforcementCandidates.length === 0 ? (
              <div className="p-8 text-center text-sm text-gov-grey-400">No enforcement candidates identified.</div>
            ) : (
              <div className="divide-y divide-gov-grey-100">
                {enforcementCandidates.map((candidate) => (
                  <div key={candidate.business} className="p-4 hover:bg-gov-grey-50">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Scale className="h-4 w-4 text-gov-red" />
                          <h3 className="text-sm font-semibold text-gov-grey-900">{candidate.business}</h3>
                          <span className="badge badge-critical">{candidate.complaintCount} complaints</span>
                        </div>
                        <p className="mt-1 text-sm text-gov-grey-600">{candidate.reason}</p>
                      </div>
                      <button className="btn-secondary text-xs gap-1">
                        Review
                        <ArrowUpRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
