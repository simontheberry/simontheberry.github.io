'use client';

import { useState } from 'react';
import { Search, Filter, SlidersHorizontal } from 'lucide-react';
import { ComplaintQueueTable } from '../../../components/dashboard/ComplaintQueueTable';
import { COMPLAINT_CATEGORIES, INDUSTRY_CLASSIFICATIONS, RISK_LEVEL_CONFIG } from '../../../src/shared/constants/categories';

const DEMO_ALL_COMPLAINTS = [
  {
    id: '1',
    referenceNumber: 'CMP-2A4F-XK91',
    summary: 'Misleading pricing on home loan comparison rate.',
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
    summary: 'Aged care facility failing to provide adequate nutrition standards.',
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
    summary: 'Telco refusing cooling-off period cancellation.',
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
    summary: 'Building contractor abandoned renovation mid-project.',
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
    summary: 'Insurance claim denial citing fine print exclusion.',
    business: 'SafeGuard Insurance Ltd',
    category: 'unfair_contract_terms',
    riskLevel: 'medium' as const,
    priorityScore: 0.55,
    status: 'awaiting_response',
    submittedAt: '2025-01-11T10:20:00Z',
    slaDeadline: '2025-01-18T10:20:00Z',
  },
  {
    id: '6',
    referenceNumber: 'CMP-7F9K-UV16',
    summary: 'Energy provider overcharging during peak tariff incorrectly.',
    business: 'PowerSave Energy',
    category: 'billing_dispute',
    riskLevel: 'low' as const,
    priorityScore: 0.32,
    status: 'in_progress',
    submittedAt: '2025-01-10T08:00:00Z',
    slaDeadline: '2025-01-17T08:00:00Z',
  },
];

export default function ComplaintsListPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRisk, setFilterRisk] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');

  const filtered = DEMO_ALL_COMPLAINTS.filter((c) => {
    if (searchQuery && !c.summary.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !c.referenceNumber.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !c.business.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filterRisk && c.riskLevel !== filterRisk) return false;
    if (filterCategory && c.category !== filterCategory) return false;
    return true;
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gov-grey-900">All Complaints</h1>
        <p className="mt-1 text-sm text-gov-grey-500">
          Browse and filter all complaints. Default sort is by priority score (highest first).
        </p>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gov-grey-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field pl-9"
                placeholder="Search by reference, business, or keyword..."
              />
            </div>
          </div>

          <select
            value={filterRisk}
            onChange={(e) => setFilterRisk(e.target.value)}
            className="input-field w-auto"
          >
            <option value="">All Risk Levels</option>
            {Object.entries(RISK_LEVEL_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="input-field w-auto"
          >
            <option value="">All Categories</option>
            {Object.entries(COMPLAINT_CATEGORIES).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        <div className="mt-2 text-xs text-gov-grey-500">
          Showing {filtered.length} of {DEMO_ALL_COMPLAINTS.length} complaints
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <ComplaintQueueTable complaints={filtered} />
      </div>
    </div>
  );
}
