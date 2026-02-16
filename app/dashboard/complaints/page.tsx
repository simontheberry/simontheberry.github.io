'use client';

import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { ComplaintQueueTable } from '../../../components/dashboard/ComplaintQueueTable';
import { QueueTableSkeleton, ErrorState } from '../../../components/dashboard/LoadingSkeleton';
import { useApi } from '../../../components/hooks/useApi';
import { COMPLAINT_CATEGORIES, RISK_LEVEL_CONFIG } from '../../../src/shared/constants/categories';
import type { RiskLevel } from '../../../src/shared/types/complaint';

interface ComplaintListItem {
  id: string;
  referenceNumber: string;
  summary: string;
  business: string;
  category: string;
  riskLevel: RiskLevel;
  priorityScore: number;
  status: string;
  submittedAt: string;
  slaDeadline: string;
}

interface ComplaintsApiResponse {
  complaints: ComplaintListItem[];
  meta: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

export default function ComplaintsListPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRisk, setFilterRisk] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [page, setPage] = useState(1);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', '20');
    params.set('sortBy', 'priorityScore');
    params.set('sortOrder', 'desc');
    if (searchQuery) params.set('search', searchQuery);
    if (filterRisk) params.set('riskLevel', filterRisk);
    if (filterCategory) params.set('category', filterCategory);
    return params.toString();
  }, [searchQuery, filterRisk, filterCategory, page]);

  const { data, isLoading, error, refetch } = useApi<ComplaintsApiResponse>(
    `/api/v1/complaints?${queryParams}`
  );

  const complaints = data?.complaints ?? [];
  const meta = data?.meta;

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
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="input-field pl-9"
                placeholder="Search by reference, business, or keyword..."
              />
            </div>
          </div>

          <select
            value={filterRisk}
            onChange={(e) => {
              setFilterRisk(e.target.value);
              setPage(1);
            }}
            className="input-field w-auto"
          >
            <option value="">All Risk Levels</option>
            {Object.entries(RISK_LEVEL_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>

          <select
            value={filterCategory}
            onChange={(e) => {
              setFilterCategory(e.target.value);
              setPage(1);
            }}
            className="input-field w-auto"
          >
            <option value="">All Categories</option>
            {Object.entries(COMPLAINT_CATEGORIES).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        <div className="mt-2 text-xs text-gov-grey-500">
          {meta
            ? `Showing ${complaints.length} of ${meta.totalCount} complaints`
            : isLoading
              ? 'Loading...'
              : 'No results'}
        </div>
      </div>

      {/* Table */}
      {error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <div className="card">
          {isLoading ? (
            <QueueTableSkeleton rows={6} />
          ) : (
            <ComplaintQueueTable complaints={complaints} />
          )}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gov-grey-500">
            Page {meta.page} of {meta.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="btn-secondary text-xs disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              disabled={page >= meta.totalPages}
              className="btn-secondary text-xs disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
