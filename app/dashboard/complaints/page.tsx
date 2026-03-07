'use client';

import { useState } from 'react';
import { Search, Filter, SlidersHorizontal } from 'lucide-react';
import { ComplaintQueueTable } from '../../../components/dashboard/ComplaintQueueTable';
import { useApi } from '../../../components/hooks/useApi';
import { COMPLAINT_CATEGORIES, INDUSTRY_CLASSIFICATIONS, RISK_LEVEL_CONFIG } from '../../../src/shared/constants/categories';

interface ComplaintListItem {
  id: string;
  referenceNumber: string;
  summary?: string;
  business?: string;
  category?: string;
  riskLevel?: string;
  priorityScore?: number;
  status: string;
  submittedAt?: string;
  slaDeadline?: string;
}

export default function ComplaintsListPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRisk, setFilterRisk] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  // Fetch complaints from API
  const queryParams = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
    ...(searchQuery && { search: searchQuery }),
    ...(filterRisk && { riskLevel: filterRisk }),
    ...(filterCategory && { category: filterCategory }),
    sortBy: 'priorityScore',
    sortOrder: 'desc',
  });

  const { data: response, isLoading, error } = useApi<{
    data: ComplaintListItem[];
    meta: { page: number; pageSize: number; totalCount: number; totalPages: number };
  }>(`/api/v1/complaints?${queryParams}`);

  const complaints = response?.data || [];
  const meta = response?.meta || { page: 1, pageSize: 20, totalCount: 0, totalPages: 0 };

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
                  setPage(1); // Reset to first page on search
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
          {isLoading ? 'Loading...' : `Showing ${complaints.length} of ${meta.totalCount} complaints`}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="card bg-red-50 border border-red-200 p-4 mb-6">
          <p className="text-sm text-red-700">Failed to load complaints: {error}</p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="card">
          <div className="p-8 text-center text-gov-grey-500">
            <p className="text-sm">Loading complaints...</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && complaints.length === 0 && (
        <div className="card">
          <div className="p-8 text-center text-gov-grey-500">
            <p className="text-sm">No complaints found matching your filters.</p>
          </div>
        </div>
      )}

      {/* Table */}
      {!isLoading && complaints.length > 0 && (
        <div className="card">
          <ComplaintQueueTable complaints={complaints} />

          {/* Pagination */}
          <div className="border-t border-gov-grey-200 p-4 flex items-center justify-between">
            <div className="text-xs text-gov-grey-500">
              Page {meta.page} of {meta.totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={meta.page <= 1}
                className="px-3 py-1 rounded border border-gov-grey-300 text-sm hover:bg-gov-grey-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                disabled={meta.page >= meta.totalPages}
                className="px-3 py-1 rounded border border-gov-grey-300 text-sm hover:bg-gov-grey-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
