'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Users,
  AlertTriangle,
  Clock,
  TrendingUp,
  Inbox,
  ArrowUpRight,
  Filter,
  ChevronDown,
} from 'lucide-react';
import { useApi } from '../../../components/hooks/useApi';
import { StatsCard } from '../../../components/dashboard/StatsCard';
import { ComplaintQueueTable } from '../../../components/dashboard/ComplaintQueueTable';

interface TeamMember {
  userId: string;
  name: string;
  role: string;
  assigned: number;
  inProgress: number;
  avgDaysToResolve: number;
  slaCompliance: number;
}

interface Bottleneck {
  type: string;
  officerId?: string;
  name?: string;
  reason?: string;
  severity: string;
  complaintId?: string;
  referenceNumber?: string;
  hoursRemaining?: number;
  count?: number;
  avgPriorityScore?: number;
}

interface SystemicAlert {
  clusterId: string;
  title: string;
  complaintCount: number;
  riskLevel: string;
  isAcknowledged: boolean;
}

interface TrendPoint {
  date: string;
  submitted: number;
  resolved: number;
  escalated: number;
}

interface SupervisorData {
  teamWorkload: TeamMember[];
  avgHandlingTime: number;
  slaComplianceRate: number;
  bottlenecks: Bottleneck[];
  systemicAlerts: SystemicAlert[];
  triageQueue: { pending: number; avgWaitMinutes: number; oldestWaitMinutes: number };
  trendData: TrendPoint[];
}

interface ComplaintListItem {
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
  assignedTo?: { id: string; firstName: string; lastName: string; email: string } | null;
}

export default function SupervisorDashboardPage() {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [memberFilter, setMemberFilter] = useState<string>('');

  const { data: supervisorData, isLoading: loadingStats, error: statsError } = useApi<SupervisorData>(
    '/api/v1/dashboard/supervisor'
  );

  // Build complaint query with filters
  const complaintParams = new URLSearchParams({
    sortBy: 'priorityScore',
    sortOrder: 'desc',
    pageSize: '100',
  });
  if (statusFilter) complaintParams.set('status', statusFilter);
  if (memberFilter) complaintParams.set('assignedTo', memberFilter);

  const { data: complaintResponse, isLoading: loadingComplaints } = useApi<{
    data: ComplaintListItem[];
    meta: { page: number; pageSize: number; totalCount: number; totalPages: number };
  }>(`/api/v1/complaints?${complaintParams.toString()}`);

  const complaints = complaintResponse?.data || [];
  const team = supervisorData?.teamWorkload || [];
  const bottlenecks = supervisorData?.bottlenecks || [];
  const systemicAlerts = supervisorData?.systemicAlerts || [];
  const triageQueue = supervisorData?.triageQueue;
  const trendData = supervisorData?.trendData || [];

  const totalAssigned = team.reduce((sum, m) => sum + m.assigned, 0);

  return (
    <div className="animate-page-enter">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gov-grey-900">Team Overview</h1>
        <p className="mt-1 text-sm text-gov-grey-500">
          Monitor team workload, SLA compliance, and systemic alerts.
        </p>
      </div>

      {statsError && (
        <div className="card bg-red-50 border border-red-200 p-4 mb-6">
          <p className="text-sm text-red-700">Failed to load supervisor data: {statsError}</p>
        </div>
      )}

      {/* Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard
          label="Team Complaints"
          value={loadingStats ? '-' : totalAssigned}
          icon={<Users className="h-5 w-5" />}
          color="blue"
        />
        <StatsCard
          label="Avg Handling Time"
          value={loadingStats ? '-' : `${supervisorData?.avgHandlingTime?.toFixed(1)}d`}
          icon={<Clock className="h-5 w-5" />}
          color="yellow"
        />
        <StatsCard
          label="SLA Compliance"
          value={loadingStats ? '-' : `${((supervisorData?.slaComplianceRate || 0) * 100).toFixed(0)}%`}
          icon={<TrendingUp className="h-5 w-5" />}
          color="green"
        />
        <StatsCard
          label="Pending Triage"
          value={loadingStats ? '-' : triageQueue?.pending || 0}
          icon={<Inbox className="h-5 w-5" />}
          color={triageQueue && triageQueue.pending > 5 ? 'red' : 'grey'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Team Workload Table */}
        <div className="lg:col-span-2 card">
          <div className="p-4 border-b border-gov-grey-100">
            <h2 className="font-medium text-gov-grey-900">Team Workload Distribution</h2>
          </div>
          {loadingStats ? (
            <div className="p-8 text-center text-gov-grey-500 text-sm">Loading team data...</div>
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
                  {team.map((member) => {
                    const slaPercent = (member.slaCompliance * 100).toFixed(0);
                    return (
                      <tr
                        key={member.userId}
                        className={`hover:bg-gov-grey-50 cursor-pointer transition-colors ${
                          memberFilter === member.userId ? 'bg-gov-blue-50' : ''
                        }`}
                        onClick={() => setMemberFilter(memberFilter === member.userId ? '' : member.userId)}
                      >
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gov-grey-900">{member.name}</p>
                          <p className="text-xs text-gov-grey-500">{member.role.replace('_', ' ')}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-gov-grey-700">{member.assigned}</td>
                        <td className="px-4 py-3 text-sm text-gov-grey-700">{member.inProgress}</td>
                        <td className="px-4 py-3 text-sm text-gov-grey-700">{member.avgDaysToResolve.toFixed(1)}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-sm font-medium ${
                              member.slaCompliance >= 0.9
                                ? 'text-gov-green'
                                : member.slaCompliance >= 0.8
                                  ? 'text-yellow-600'
                                  : 'text-gov-red'
                            }`}
                          >
                            {slaPercent}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column: Alerts + Bottlenecks */}
        <div className="space-y-6">
          {/* Systemic Alerts */}
          <div className="card">
            <div className="p-4 border-b border-gov-grey-100 flex items-center justify-between">
              <h2 className="font-medium text-gov-grey-900">Systemic Alerts</h2>
              <Link
                href="/dashboard/systemic"
                className="text-xs text-gov-blue-500 hover:text-gov-blue-700 font-medium flex items-center gap-1"
              >
                View all <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="p-4 space-y-3">
              {loadingStats ? (
                <p className="text-sm text-gov-grey-500">Loading alerts...</p>
              ) : systemicAlerts.length === 0 ? (
                <p className="text-sm text-gov-grey-400">No active systemic alerts.</p>
              ) : (
                systemicAlerts.map((alert) => (
                  <div
                    key={alert.clusterId}
                    className={`rounded-lg border p-3 ${
                      alert.riskLevel === 'critical'
                        ? 'border-red-200 bg-red-50'
                        : alert.riskLevel === 'high'
                          ? 'border-orange-200 bg-orange-50'
                          : 'border-yellow-200 bg-yellow-50'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle
                        className={`h-4 w-4 mt-0.5 ${
                          alert.riskLevel === 'critical' ? 'text-red-500' : alert.riskLevel === 'high' ? 'text-orange-500' : 'text-yellow-500'
                        }`}
                      />
                      <div>
                        <p className="text-sm font-medium text-gov-grey-900">{alert.title}</p>
                        <p className="text-xs text-gov-grey-600 mt-0.5">
                          {alert.complaintCount} complaints &middot;{' '}
                          <span className="capitalize">{alert.riskLevel}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Bottlenecks */}
          {bottlenecks.length > 0 && (
            <div className="card">
              <div className="p-4 border-b border-gov-grey-100">
                <h2 className="font-medium text-gov-grey-900">Bottlenecks</h2>
              </div>
              <div className="p-4 space-y-3">
                {bottlenecks.map((b, i) => (
                  <div
                    key={i}
                    className={`rounded-lg border p-3 ${
                      b.severity === 'critical'
                        ? 'border-red-200 bg-red-50'
                        : b.severity === 'high'
                          ? 'border-orange-200 bg-orange-50'
                          : 'border-gov-grey-200 bg-gov-grey-50'
                    }`}
                  >
                    <p className="text-sm font-medium text-gov-grey-900">
                      {b.type === 'high_load' && `${b.name}: overloaded`}
                      {b.type === 'sla_risk' && `SLA breach risk: ${b.referenceNumber}`}
                      {b.type === 'unassigned' && `${b.count} unassigned complaints`}
                    </p>
                    <p className="text-xs text-gov-grey-600 mt-0.5">
                      {b.type === 'high_load' && b.reason}
                      {b.type === 'sla_risk' && `${b.hoursRemaining}h remaining`}
                      {b.type === 'unassigned' && `Avg priority: ${((b.avgPriorityScore || 0) * 100).toFixed(0)}`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 7-Day Trend */}
          {trendData.length > 0 && (
            <div className="card">
              <div className="p-4 border-b border-gov-grey-100">
                <h2 className="font-medium text-gov-grey-900">7-Day Trend</h2>
              </div>
              <div className="p-4">
                <div className="flex items-end gap-1 h-24">
                  {trendData.map((point) => {
                    const maxVal = Math.max(...trendData.map((p) => p.submitted));
                    const height = maxVal > 0 ? (point.submitted / maxVal) * 100 : 0;
                    return (
                      <div key={point.date} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[9px] text-gov-grey-400 font-mono">{point.submitted}</span>
                        <div
                          className="w-full rounded-t bg-gov-blue-500/70"
                          style={{ height: `${height}%`, minHeight: '4px' }}
                        />
                        <span className="text-[9px] text-gov-grey-400">
                          {new Date(point.date).toLocaleDateString('en-AU', { weekday: 'short' }).slice(0, 2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 mt-3 text-[10px] text-gov-grey-500">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-gov-blue-500/70" /> Submitted
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Team Complaints Queue */}
      <div className="card">
        <div className="p-4 border-b border-gov-grey-100 flex items-center justify-between">
          <h2 className="font-medium text-gov-grey-900">
            Team Complaints
            {memberFilter && (
              <span className="ml-2 text-xs font-normal text-gov-grey-500">
                (filtered by officer)
              </span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            {/* Status Filter */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none rounded-md border border-gov-grey-300 bg-white pl-3 pr-8 py-1.5 text-xs text-gov-grey-700 shadow-sm focus:ring-1 focus:ring-gov-blue-500"
              >
                <option value="">All statuses</option>
                <option value="submitted">Submitted</option>
                <option value="triaging">Triaging</option>
                <option value="triaged">Triaged</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="awaiting_response">Awaiting Response</option>
                <option value="escalated">Escalated</option>
                <option value="resolved">Resolved</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gov-grey-400 pointer-events-none" />
            </div>

            {(statusFilter || memberFilter) && (
              <button
                onClick={() => { setStatusFilter(''); setMemberFilter(''); }}
                className="text-xs text-gov-blue-500 hover:text-gov-blue-700 font-medium"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {loadingComplaints ? (
          <div className="p-8 text-center text-gov-grey-500 text-sm">Loading complaints...</div>
        ) : complaints.length === 0 ? (
          <div className="p-8 text-center text-gov-grey-400 text-sm">No complaints match current filters.</div>
        ) : (
          <ComplaintQueueTable complaints={complaints} />
        )}
      </div>
    </div>
  );
}
