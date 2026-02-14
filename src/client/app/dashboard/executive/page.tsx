'use client';

import {
  TrendingUp,
  AlertTriangle,
  Building2,
  Scale,
  BarChart3,
  ArrowUpRight,
} from 'lucide-react';
import { StatsCard } from '../../../components/dashboard/StatsCard';

const DEMO_INDUSTRY_RISK = [
  { industry: 'Financial Services', complaints: 45, avgRisk: 0.72, systemicClusters: 3, trend: 'up' as const },
  { industry: 'Telecommunications', complaints: 38, avgRisk: 0.58, systemicClusters: 1, trend: 'stable' as const },
  { industry: 'Energy', complaints: 31, avgRisk: 0.65, systemicClusters: 2, trend: 'up' as const },
  { industry: 'Building & Construction', complaints: 22, avgRisk: 0.71, systemicClusters: 1, trend: 'down' as const },
  { industry: 'Aged Care', complaints: 18, avgRisk: 0.82, systemicClusters: 1, trend: 'up' as const },
  { industry: 'Insurance', complaints: 15, avgRisk: 0.61, systemicClusters: 0, trend: 'stable' as const },
];

const DEMO_REPEAT_OFFENDERS = [
  { name: 'National Finance Group', complaints: 12, avgRisk: 0.85, industry: 'Financial Services' },
  { name: 'QuickConnect Telecom', complaints: 9, avgRisk: 0.64, industry: 'Telecommunications' },
  { name: 'PowerSave Energy', complaints: 8, avgRisk: 0.71, industry: 'Energy' },
  { name: 'Sunrise Aged Care', complaints: 7, avgRisk: 0.88, industry: 'Aged Care' },
  { name: 'Premier Builds Australia', complaints: 6, avgRisk: 0.76, industry: 'Building & Construction' },
];

const DEMO_ENFORCEMENT_CANDIDATES = [
  {
    business: 'National Finance Group',
    reason: 'Systemic misleading pricing across 12 complaints. Pattern consistent with ACL s18 breach.',
    complaintCount: 12,
    avgRisk: 0.85,
  },
  {
    business: 'Sunrise Aged Care',
    reason: 'Repeated service quality failures affecting vulnerable consumers. High public harm indicator.',
    complaintCount: 7,
    avgRisk: 0.88,
  },
];

export default function ExecutiveDashboardPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gov-grey-900">Executive Overview</h1>
        <p className="mt-1 text-sm text-gov-grey-500">
          Industry risk landscape, enforcement candidates, and emerging conduct risks.
        </p>
      </div>

      {/* Top-Level Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard
          label="Total Complaints"
          value={186}
          icon={<BarChart3 className="h-5 w-5" />}
          color="blue"
          trend={{ value: 12, direction: 'up' }}
        />
        <StatsCard
          label="Systemic Clusters"
          value={8}
          icon={<AlertTriangle className="h-5 w-5" />}
          color="red"
          trend={{ value: 3, direction: 'up' }}
        />
        <StatsCard
          label="Repeat Offenders"
          value={14}
          icon={<Building2 className="h-5 w-5" />}
          color="orange"
        />
        <StatsCard
          label="Enforcement Candidates"
          value={2}
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
                {DEMO_INDUSTRY_RISK.map((row) => (
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
        </div>

        {/* Repeat Offender Index */}
        <div className="card">
          <div className="p-4 border-b border-gov-grey-100">
            <h2 className="font-medium text-gov-grey-900">Repeat Offender Index</h2>
          </div>
          <div className="p-4 space-y-3">
            {DEMO_REPEAT_OFFENDERS.map((offender, i) => (
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
            ))}
          </div>
        </div>
      </div>

      {/* Enforcement Candidates */}
      <div className="card">
        <div className="p-4 border-b border-gov-grey-100">
          <h2 className="font-medium text-gov-grey-900">Enforcement Referral Candidates</h2>
        </div>
        <div className="divide-y divide-gov-grey-100">
          {DEMO_ENFORCEMENT_CANDIDATES.map((candidate) => (
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
      </div>
    </div>
  );
}
