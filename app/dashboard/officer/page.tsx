'use client';

import {
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import { ComplaintQueueTable } from '../../../components/dashboard/ComplaintQueueTable';
import { StatsCard } from '../../../components/dashboard/StatsCard';

// Demo data for scaffolding
const DEMO_STATS = {
  assigned: 12,
  inProgress: 4,
  awaitingResponse: 3,
  resolvedThisWeek: 8,
};

const DEMO_QUEUE = [
  {
    id: '1',
    referenceNumber: 'CMP-2A4F-XK91',
    summary: 'Misleading pricing on home loan comparison rate. Consumer charged fees not disclosed in initial quote.',
    business: 'National Finance Group Pty Ltd',
    category: 'misleading_conduct',
    riskLevel: 'critical' as const,
    priorityScore: 0.92,
    status: 'triaged',
    submittedAt: '2025-01-15T09:30:00Z',
    slaDeadline: '2025-01-22T09:30:00Z',
  },
  {
    id: '2',
    referenceNumber: 'CMP-3B5G-LM72',
    summary: 'Aged care facility failing to provide adequate nutrition and hygiene standards for residents.',
    business: 'Sunrise Aged Care Holdings',
    category: 'service_quality',
    riskLevel: 'high' as const,
    priorityScore: 0.84,
    status: 'assigned',
    submittedAt: '2025-01-14T14:15:00Z',
    slaDeadline: '2025-01-21T14:15:00Z',
  },
  {
    id: '3',
    referenceNumber: 'CMP-4C6H-NP83',
    summary: 'Telecommunications provider refusing to honour cooling-off period cancellation request.',
    business: 'QuickConnect Telecom',
    category: 'unfair_contract_terms',
    riskLevel: 'medium' as const,
    priorityScore: 0.61,
    status: 'in_progress',
    submittedAt: '2025-01-13T11:00:00Z',
    slaDeadline: '2025-01-20T11:00:00Z',
  },
  {
    id: '4',
    referenceNumber: 'CMP-5D7I-QR94',
    summary: 'Building contractor abandoned renovation mid-project after receiving 80% payment.',
    business: 'Premier Builds Australia',
    category: 'scam_fraud',
    riskLevel: 'high' as const,
    priorityScore: 0.78,
    status: 'triaged',
    submittedAt: '2025-01-12T16:45:00Z',
    slaDeadline: '2025-01-19T16:45:00Z',
  },
  {
    id: '5',
    referenceNumber: 'CMP-6E8J-ST05',
    summary: 'Insurance company denying valid claim citing exclusion clause in fine print.',
    business: 'SafeGuard Insurance Ltd',
    category: 'unfair_contract_terms',
    riskLevel: 'medium' as const,
    priorityScore: 0.55,
    status: 'awaiting_response',
    submittedAt: '2025-01-11T10:20:00Z',
    slaDeadline: '2025-01-18T10:20:00Z',
  },
];

export default function OfficerDashboardPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gov-grey-900">My Queue</h1>
        <p className="mt-1 text-sm text-gov-grey-500">
          Complaints assigned to you, sorted by priority score.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard
          label="Assigned"
          value={DEMO_STATS.assigned}
          icon={<FileText className="h-5 w-5" />}
          color="blue"
        />
        <StatsCard
          label="In Progress"
          value={DEMO_STATS.inProgress}
          icon={<Clock className="h-5 w-5" />}
          color="yellow"
        />
        <StatsCard
          label="Awaiting Response"
          value={DEMO_STATS.awaitingResponse}
          icon={<AlertTriangle className="h-5 w-5" />}
          color="orange"
        />
        <StatsCard
          label="Resolved This Week"
          value={DEMO_STATS.resolvedThisWeek}
          icon={<CheckCircle2 className="h-5 w-5" />}
          color="green"
        />
      </div>

      {/* Queue Table */}
      <div className="card">
        <div className="p-4 border-b border-gov-grey-100 flex items-center justify-between">
          <h2 className="font-medium text-gov-grey-900">Priority Queue</h2>
          <div className="flex items-center gap-1.5 text-xs text-gov-grey-500">
            <Sparkles className="h-3.5 w-3.5" />
            Sorted by AI priority score
          </div>
        </div>
        <ComplaintQueueTable complaints={DEMO_QUEUE} />
      </div>
    </div>
  );
}
