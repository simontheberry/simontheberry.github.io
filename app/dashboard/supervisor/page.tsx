'use client';

import {
  Users,
  AlertTriangle,
  Clock,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import { StatsCard } from '../../../components/dashboard/StatsCard';

const DEMO_TEAM_WORKLOAD = [
  { name: 'Sarah Chen', role: 'Senior Officer', assigned: 8, inProgress: 3, avgDays: 4.2, slaCompliance: 95 },
  { name: 'James Park', role: 'Officer', assigned: 12, inProgress: 5, avgDays: 5.1, slaCompliance: 88 },
  { name: 'Maria Santos', role: 'Officer', assigned: 10, inProgress: 4, avgDays: 3.8, slaCompliance: 97 },
  { name: 'David Liu', role: 'Junior Officer', assigned: 6, inProgress: 2, avgDays: 6.3, slaCompliance: 82 },
];

const DEMO_SYSTEMIC_ALERTS = [
  {
    id: '1',
    title: 'Energy provider billing discrepancies',
    complaintCount: 14,
    industry: 'Energy',
    riskLevel: 'high',
    detectedAt: '2025-01-14T08:00:00Z',
  },
  {
    id: '2',
    title: 'Building defect warranty refusals',
    complaintCount: 8,
    industry: 'Building & Construction',
    riskLevel: 'medium',
    detectedAt: '2025-01-13T12:30:00Z',
  },
];

export default function SupervisorDashboardPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gov-grey-900">Team Overview</h1>
        <p className="mt-1 text-sm text-gov-grey-500">
          Monitor team workload, SLA compliance, and systemic alerts.
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard label="Team Members" value={4} icon={<Users className="h-5 w-5" />} color="blue" />
        <StatsCard
          label="Avg Handling Time"
          value="4.8d"
          icon={<Clock className="h-5 w-5" />}
          color="yellow"
        />
        <StatsCard
          label="SLA Compliance"
          value="91%"
          icon={<TrendingUp className="h-5 w-5" />}
          color="green"
        />
        <StatsCard
          label="Systemic Alerts"
          value={2}
          icon={<AlertTriangle className="h-5 w-5" />}
          color="red"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Team Workload */}
        <div className="lg:col-span-2 card">
          <div className="p-4 border-b border-gov-grey-100">
            <h2 className="font-medium text-gov-grey-900">Team Workload Distribution</h2>
          </div>
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
                {DEMO_TEAM_WORKLOAD.map((member) => (
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
        </div>

        {/* Systemic Alerts */}
        <div className="card">
          <div className="p-4 border-b border-gov-grey-100">
            <h2 className="font-medium text-gov-grey-900">Systemic Alerts</h2>
          </div>
          <div className="p-4 space-y-3">
            {DEMO_SYSTEMIC_ALERTS.map((alert) => (
              <div
                key={alert.id}
                className={`rounded-lg border p-3 ${
                  alert.riskLevel === 'high'
                    ? 'border-red-200 bg-red-50'
                    : 'border-yellow-200 bg-yellow-50'
                }`}
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle
                    className={`h-4 w-4 mt-0.5 ${
                      alert.riskLevel === 'high' ? 'text-red-500' : 'text-yellow-500'
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
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
