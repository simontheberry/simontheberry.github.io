'use client';

import Link from 'next/link';
import { ArrowUpRight, Clock } from 'lucide-react';
import { COMPLAINT_CATEGORIES, RISK_LEVEL_CONFIG, STATUS_LABELS } from '../../src/shared/constants/categories';

interface QueueComplaint {
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

interface Props {
  complaints: QueueComplaint[];
}

export function ComplaintQueueTable({ complaints }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gov-grey-100">
            <th className="px-4 py-3 text-left text-xs font-medium text-gov-grey-500 uppercase tracking-wider">
              Reference
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gov-grey-500 uppercase tracking-wider">
              Summary
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gov-grey-500 uppercase tracking-wider">
              Risk
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gov-grey-500 uppercase tracking-wider">
              Priority
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gov-grey-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gov-grey-500 uppercase tracking-wider">
              SLA
            </th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gov-grey-100">
          {complaints.map((complaint) => {
            const riskConfig = RISK_LEVEL_CONFIG[complaint.riskLevel];
            const slaRemaining = getSlaRemaining(complaint.slaDeadline);

            return (
              <tr key={complaint.id} className="hover:bg-gov-grey-50 transition-colors">
                <td className="px-4 py-3">
                  <span className="text-sm font-mono font-medium text-gov-blue-500">
                    {complaint.referenceNumber}
                  </span>
                </td>
                <td className="px-4 py-3 max-w-md">
                  <p className="text-sm text-gov-grey-900 truncate">{complaint.summary}</p>
                  <p className="text-xs text-gov-grey-500 mt-0.5">
                    {complaint.business} &middot;{' '}
                    {COMPLAINT_CATEGORIES[complaint.category as keyof typeof COMPLAINT_CATEGORIES] || complaint.category}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`badge badge-${complaint.riskLevel}`}
                  >
                    {riskConfig.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-1.5 rounded-full bg-gov-grey-200">
                      <div
                        className="h-1.5 rounded-full"
                        style={{
                          width: `${complaint.priorityScore * 100}%`,
                          backgroundColor: riskConfig.color,
                        }}
                      />
                    </div>
                    <span className="text-xs font-mono text-gov-grey-600">
                      {(complaint.priorityScore * 100).toFixed(0)}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-gov-grey-600">
                    {STATUS_LABELS[complaint.status] || complaint.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 text-xs ${
                      slaRemaining.isOverdue ? 'text-red-600 font-medium' : 'text-gov-grey-500'
                    }`}
                  >
                    <Clock className="h-3 w-3" />
                    {slaRemaining.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/complaints?id=${complaint.id}`}
                    className="inline-flex items-center gap-1 text-sm text-gov-blue-500 hover:text-gov-blue-700 font-medium"
                  >
                    View
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {complaints.length === 0 && (
        <div className="py-12 text-center text-sm text-gov-grey-400">
          No complaints in your queue.
        </div>
      )}
    </div>
  );
}

function getSlaRemaining(deadline: string): { label: string; isOverdue: boolean } {
  const now = new Date();
  const sla = new Date(deadline);
  const diffMs = sla.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffMs < 0) {
    return { label: `${Math.abs(diffDays)}d overdue`, isOverdue: true };
  }
  if (diffDays > 0) {
    return { label: `${diffDays}d left`, isOverdue: false };
  }
  return { label: `${diffHours}h left`, isOverdue: false };
}
