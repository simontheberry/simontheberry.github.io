'use client';

import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Building2,
  Scale,
  BarChart3,
  ArrowUpRight,
  Minus,
} from 'lucide-react';
import { useApi } from '../../../components/hooks/useApi';
import { StatsCard } from '../../../components/dashboard/StatsCard';

interface IndustryRisk {
  industry: string;
  totalComplaints: number;
  criticalCount: number;
  highCount: number;
  avgPriorityScore: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

interface EnforcementCandidate {
  businessId: string;
  name: string;
  abn: string;
  industry: string;
  complaintCount: number;
  avgRiskScore: number;
  systemicClusters: number;
  estimatedConsumerHarm: string;
  recommendation: string;
}

interface RepeatOffender {
  businessId: string;
  name: string;
  complaintCount: number;
  avgRisk: number;
  industry: string;
}

interface VolumeTrend {
  week: string;
  count: number;
}

interface ExecutiveData {
  industryRiskMap: IndustryRisk[];
  enforcementCandidates: EnforcementCandidate[];
  repeatOffenderIndex: RepeatOffender[];
  complaintVolumeTrend: VolumeTrend[];
}

interface DashboardStats {
  totalComplaints: number;
  systemicAlerts: number;
  statusBreakdown: Record<string, number>;
  riskBreakdown: Record<string, number>;
}

const TREND_ICON = {
  increasing: <TrendingUp className="h-3.5 w-3.5 text-red-600" />,
  decreasing: <TrendingDown className="h-3.5 w-3.5 text-green-600" />,
  stable: <Minus className="h-3.5 w-3.5 text-gov-grey-400" />,
};

const TREND_LABEL = {
  increasing: 'Rising',
  decreasing: 'Declining',
  stable: 'Stable',
};

const TREND_COLOR = {
  increasing: 'text-red-600',
  decreasing: 'text-green-600',
  stable: 'text-gov-grey-500',
};

export default function ExecutiveDashboardPage() {
  const { data: execData, isLoading: loadingExec, error: execError } = useApi<ExecutiveData>(
    '/api/v1/dashboard/executive'
  );
  const { data: statsData, isLoading: loadingStats } = useApi<DashboardStats>(
    '/api/v1/dashboard/stats'
  );

  const industries = execData?.industryRiskMap || [];
  const enforcementCandidates = execData?.enforcementCandidates || [];
  const repeatOffenders = execData?.repeatOffenderIndex || [];
  const volumeTrend = execData?.complaintVolumeTrend || [];

  const totalComplaints = statsData?.totalComplaints || 0;
  const systemicAlerts = statsData?.systemicAlerts || 0;
  const repeatOffenderCount = repeatOffenders.length;
  const enforcementCount = enforcementCandidates.length;

  const isLoading = loadingExec || loadingStats;

  return (
    <div className="animate-page-enter">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gov-grey-900">Executive Overview</h1>
        <p className="mt-1 text-sm text-gov-grey-500">
          Industry risk landscape, enforcement candidates, and emerging conduct risks.
        </p>
      </div>

      {execError && (
        <div className="card bg-red-50 border border-red-200 p-4 mb-6">
          <p className="text-sm text-red-700">Failed to load executive data: {execError}</p>
        </div>
      )}

      {/* Top-Level Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard
          label="Total Complaints"
          value={isLoading ? '-' : totalComplaints}
          icon={<BarChart3 className="h-5 w-5" />}
          color="blue"
        />
        <StatsCard
          label="Systemic Clusters"
          value={isLoading ? '-' : systemicAlerts}
          icon={<AlertTriangle className="h-5 w-5" />}
          color="red"
        />
        <StatsCard
          label="Repeat Offenders"
          value={isLoading ? '-' : repeatOffenderCount}
          icon={<Building2 className="h-5 w-5" />}
          color="orange"
        />
        <StatsCard
          label="Enforcement Candidates"
          value={isLoading ? '-' : enforcementCount}
          icon={<Scale className="h-5 w-5" />}
          color="red"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Industry Risk Map */}
        <div className="card">
          <div className="p-4 border-b border-gov-grey-100">
            <h2 className="font-medium text-gov-grey-900">Industry Risk Map</h2>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-gov-grey-500 text-sm">Loading industry data...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gov-grey-100">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gov-grey-500 uppercase">Industry</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gov-grey-500 uppercase">Complaints</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gov-grey-500 uppercase">Avg Risk</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gov-grey-500 uppercase">Critical</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gov-grey-500 uppercase">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gov-grey-100">
                  {industries.map((row) => (
                    <tr key={row.industry} className="hover:bg-gov-grey-50">
                      <td className="px-4 py-3 text-sm font-medium text-gov-grey-900">{row.industry}</td>
                      <td className="px-4 py-3 text-sm text-gov-grey-700">{row.totalComplaints}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 rounded-full bg-gov-grey-200">
                            <div
                              className="h-2 rounded-full"
                              style={{
                                width: `${row.avgPriorityScore * 100}%`,
                                backgroundColor:
                                  row.avgPriorityScore > 0.7 ? '#ef4444' : row.avgPriorityScore > 0.5 ? '#f59e0b' : '#22c55e',
                              }}
                            />
                          </div>
                          <span className="text-xs font-mono text-gov-grey-600">{(row.avgPriorityScore * 100).toFixed(0)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {row.criticalCount > 0 ? (
                          <span className="badge badge-critical">{row.criticalCount}</span>
                        ) : (
                          <span className="text-xs text-gov-grey-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${TREND_COLOR[row.trend]}`}>
                          {TREND_ICON[row.trend]}
                          {TREND_LABEL[row.trend]}
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
          {isLoading ? (
            <div className="p-8 text-center text-gov-grey-500 text-sm">Loading offender data...</div>
          ) : (
            <div className="p-4 space-y-3">
              {repeatOffenders.map((offender, i) => (
                <div key={offender.businessId} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gov-grey-100 text-xs font-medium text-gov-grey-600">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gov-grey-900 truncate">{offender.name}</p>
                    <p className="text-xs text-gov-grey-500">
                      {offender.complaintCount} complaints &middot; {offender.industry}
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
              ))}
              {repeatOffenders.length === 0 && (
                <p className="text-sm text-gov-grey-400">No repeat offenders identified.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Complaint Volume Trend */}
      {volumeTrend.length > 0 && (
        <div className="card mb-6">
          <div className="p-4 border-b border-gov-grey-100">
            <h2 className="font-medium text-gov-grey-900">Weekly Complaint Volume</h2>
          </div>
          <div className="p-4">
            <div className="flex items-end gap-2 h-32">
              {volumeTrend.map((point) => {
                const maxVal = Math.max(...volumeTrend.map((p) => p.count));
                const height = maxVal > 0 ? (point.count / maxVal) * 100 : 0;
                const weekNum = point.week.split('W')[1];
                return (
                  <div key={point.week} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs text-gov-grey-500 font-mono">{point.count}</span>
                    <div
                      className="w-full rounded-t bg-gov-blue-500/80 hover:bg-gov-blue-500 transition-colors"
                      style={{ height: `${height}%`, minHeight: '4px' }}
                    />
                    <span className="text-[10px] text-gov-grey-400">W{weekNum}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Enforcement Candidates */}
      <div className="card">
        <div className="p-4 border-b border-gov-grey-100">
          <h2 className="font-medium text-gov-grey-900">Enforcement Referral Candidates</h2>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-gov-grey-500 text-sm">Loading enforcement data...</div>
        ) : enforcementCandidates.length === 0 ? (
          <div className="p-8 text-center text-gov-grey-400 text-sm">No enforcement candidates identified.</div>
        ) : (
          <div className="divide-y divide-gov-grey-100">
            {enforcementCandidates.map((candidate) => (
              <div key={candidate.businessId} className="p-4 hover:bg-gov-grey-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Scale className="h-4 w-4 text-gov-red shrink-0" />
                      <h3 className="text-sm font-semibold text-gov-grey-900">{candidate.name}</h3>
                      <span className="badge badge-critical">{candidate.complaintCount} complaints</span>
                      {candidate.systemicClusters > 0 && (
                        <span className="badge bg-purple-100 text-purple-800">
                          {candidate.systemicClusters} systemic cluster{candidate.systemicClusters > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gov-grey-600">{candidate.recommendation}</p>
                    <div className="mt-2 flex items-center gap-4 text-xs text-gov-grey-500">
                      <span>ABN: {candidate.abn}</span>
                      <span>Industry: {candidate.industry}</span>
                      <span>Est. harm: {candidate.estimatedConsumerHarm}</span>
                      <span>Avg risk: <span className="font-mono font-medium text-red-600">{(candidate.avgRiskScore * 100).toFixed(0)}</span></span>
                    </div>
                  </div>
                  <button className="btn-secondary text-xs gap-1 shrink-0">
                    Review
                    <ArrowUpRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
