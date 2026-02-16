'use client';

import {
  Users,
  AlertTriangle,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { StatsCard } from '../../../components/dashboard/StatsCard';
import { StatsCardSkeleton, ErrorState } from '../../../components/dashboard/LoadingSkeleton';
import { useApi } from '../../../components/hooks/useApi';

interface TeamMember {
  name: string;
  role: string;
  assigned: number;
  inProgress: number;
  avgDays: number;
  slaCompliance: number;
}

interface SystemicAlert {
  id: string;
  title: string;
  complaintCount: number;
  industry: string;
  riskLevel: string;
  detectedAt: string;
}

interface SupervisorDashboardData {
  teamWorkload: TeamMember[];
  avgHandlingTime: number;
  systemicAlerts: SystemicAlert[];
  trendData: unknown[];
}

export default function SupervisorDashboardPage() {
  const { data, isLoading, error, refetch } = useApi<SupervisorDashboardData>(
    '/api/v1/dashboard/supervisor'
  );

  const teamWorkload = data?.teamWorkload ?? [];
  const systemicAlerts = data?.systemicAlerts ?? [];
  const avgHandlingTime = data?.avgHandlingTime ?? 0;

  const teamCount = teamWorkload.length;
  const avgSla = teamWorkload.length > 0
    ? Math.round(teamWorkload.reduce((sum, m) => sum + m.slaCompliance, 0) / teamWorkload.length)
    : 0;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gov-grey-900">Team Overview</h1>
        <p className="mt-1 text-sm text-gov-grey-500">
          Monitor team workload, SLA compliance, and systemic alerts.
        </p>
      </div>

      {error ? (
        <div className="mb-8">
          <ErrorState message={error} onRetry={refetch} />
        </div>
      ) : (
        <>
          {/* Overview Stats */}
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
                <StatsCard label="Team Members" value={teamCount} icon={<Users className="h-5 w-5" />} color="blue" />
                <StatsCard
                  label="Avg Handling Time"
                  value={avgHandlingTime > 0 ? `${avgHandlingTime.toFixed(1)}d` : '0d'}
                  icon={<Clock className="h-5 w-5" />}
                  color="yellow"
                />
                <StatsCard
                  label="SLA Compliance"
                  value={`${avgSla}%`}
                  icon={<TrendingUp className="h-5 w-5" />}
                  color="green"
                />
                <StatsCard
                  label="Systemic Alerts"
                  value={systemicAlerts.length}
                  icon={<AlertTriangle className="h-5 w-5" />}
                  color="red"
                />
              </>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Team Workload */}
            <div className="lg:col-span-2 card">
              <div className="p-4 border-b border-gov-grey-100">
                <h2 className="font-medium text-gov-grey-900">Team Workload Distribution</h2>
              </div>
              {isLoading ? (
                <div className="p-8 text-center text-sm text-gov-grey-400 animate-pulse">Loading team data...</div>
              ) : teamWorkload.length === 0 ? (
                <div className="p-8 text-center text-sm text-gov-grey-400">No team members found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gov-grey-100">
                        <th className="px-4 py-3 text-left text-xs font-medium text-gov-grey-500 uppercase">Officer</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gov-grey-500 uppercase">Assigned</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gov-grey-500 uppercase">In Progress</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gov-grey-500 uppercase">Avg Days</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gov-grey-500 uppercase">SLA %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gov-grey-100">
                      {teamWorkload.map((member) => (
                        <tr key={member.name} className="hover:bg-gov-grey-50">
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-gov-grey-900">{member.name}</p>
                            <p className="text-xs text-gov-grey-500">{member.role}</p>
                          </td>
                          <td className="px-4 py-3 text-sm">{member.assigned}</td>
                          <td className="px-4 py-3 text-sm">{member.inProgress}</td>
                          <td className="px-4 py-3 text-sm">{member.avgDays}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`text-sm font-medium ${
                                member.slaCompliance >= 90
                                  ? 'text-gov-green'
                                  : member.slaCompliance >= 80
                                    ? 'text-yellow-600'
                                    : 'text-gov-red'
                              }`}
                            >
                              {member.slaCompliance}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Systemic Alerts */}
            <div className="card">
              <div className="p-4 border-b border-gov-grey-100">
                <h2 className="font-medium text-gov-grey-900">Systemic Alerts</h2>
              </div>
              <div className="p-4 space-y-3">
                {isLoading ? (
                  <div className="text-center text-sm text-gov-grey-400 animate-pulse py-4">Loading...</div>
                ) : systemicAlerts.length === 0 ? (
                  <div className="text-center text-sm text-gov-grey-400 py-4">No active alerts.</div>
                ) : (
                  systemicAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`rounded-lg border p-3 ${
                        alert.riskLevel === 'high' || alert.riskLevel === 'critical'
                          ? 'border-red-200 bg-red-50'
                          : 'border-yellow-200 bg-yellow-50'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle
                          className={`h-4 w-4 mt-0.5 ${
                            alert.riskLevel === 'high' || alert.riskLevel === 'critical'
                              ? 'text-red-500'
                              : 'text-yellow-500'
                          }`}
                        />
                        <div>
                          <p className="text-sm font-medium text-gov-grey-900">{alert.title}</p>
                          <p className="text-xs text-gov-grey-600 mt-0.5">
                            {alert.complaintCount} complaints &middot; {alert.industry}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
