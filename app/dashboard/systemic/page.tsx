'use client';

import {
  AlertTriangle,
  Activity,
  TrendingUp,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import { StatsCard } from '../../../components/dashboard/StatsCard';

const DEMO_CLUSTERS = [
  {
    id: '1',
    title: 'Misleading comparison rates in personal lending',
    description: 'Multiple complaints involving personal loan comparison rates that do not include mandatory fees, across several financial service providers.',
    industry: 'Financial Services',
    category: 'misleading_conduct',
    riskLevel: 'critical',
    complaintCount: 14,
    avgSimilarity: 0.91,
    commonPatterns: ['Hidden fees in comparison rate', 'Advertising vs actual rate discrepancy', 'Failure to disclose ongoing charges'],
    isAcknowledged: false,
    detectedAt: '2025-01-14T08:00:00Z',
  },
  {
    id: '2',
    title: 'Energy billing errors during tariff transitions',
    description: 'Cluster of complaints about incorrect billing during tariff structure changes, primarily affecting customers on legacy plans.',
    industry: 'Energy',
    category: 'billing_dispute',
    riskLevel: 'high',
    complaintCount: 11,
    avgSimilarity: 0.87,
    commonPatterns: ['Retroactive tariff application', 'Delayed billing corrections', 'Inconsistent metering data'],
    isAcknowledged: true,
    detectedAt: '2025-01-10T14:30:00Z',
  },
  {
    id: '3',
    title: 'Building defect warranty claim refusals',
    description: 'Pattern of builders refusing to honour statutory warranty obligations on residential construction within the defect liability period.',
    industry: 'Building & Construction',
    category: 'warranty_guarantee',
    riskLevel: 'high',
    complaintCount: 8,
    avgSimilarity: 0.84,
    commonPatterns: ['Warranty period disputes', 'Blaming subcontractors', 'Ceased trading to avoid obligations'],
    isAcknowledged: false,
    detectedAt: '2025-01-12T10:00:00Z',
  },
  {
    id: '4',
    title: 'Aged care medication management failures',
    description: 'Reports of incorrect medication administration and lack of qualified staff oversight in residential aged care facilities.',
    industry: 'Aged Care',
    category: 'service_quality',
    riskLevel: 'critical',
    complaintCount: 6,
    avgSimilarity: 0.88,
    commonPatterns: ['Missed medications', 'Incorrect dosages', 'Lack of clinical oversight'],
    isAcknowledged: false,
    detectedAt: '2025-01-13T16:00:00Z',
  },
];

export default function SystemicIssuesPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gov-grey-900">Systemic Issue Detection</h1>
        <p className="mt-1 text-sm text-gov-grey-500">
          AI-detected clusters of related complaints indicating potential systemic consumer harm.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard label="Active Clusters" value={4} icon={<Activity className="h-5 w-5" />} color="red" />
        <StatsCard label="Unacknowledged" value={3} icon={<AlertTriangle className="h-5 w-5" />} color="orange" />
        <StatsCard label="Total Complaints in Clusters" value={39} icon={<TrendingUp className="h-5 w-5" />} color="blue" />
        <StatsCard label="Industries Affected" value={4} icon={<Eye className="h-5 w-5" />} color="yellow" />
      </div>

      {/* Cluster Cards */}
      <div className="space-y-4">
        {DEMO_CLUSTERS.map((cluster) => (
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
                </div>

                <div className="ml-4 flex flex-col gap-2">
                  {!cluster.isAcknowledged && (
                    <button className="btn-primary text-xs">
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
    </div>
  );
}
