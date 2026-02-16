'use client';

export function StatsCardSkeleton() {
  return (
    <div className="card p-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="rounded-lg bg-gov-grey-200 h-9 w-9" />
      </div>
      <div className="mt-3 space-y-2">
        <div className="h-7 w-12 bg-gov-grey-200 rounded" />
        <div className="h-4 w-20 bg-gov-grey-100 rounded" />
      </div>
    </div>
  );
}

export function TableRowSkeleton() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3"><div className="h-4 w-24 bg-gov-grey-200 rounded" /></td>
      <td className="px-4 py-3">
        <div className="h-4 w-48 bg-gov-grey-200 rounded mb-1" />
        <div className="h-3 w-32 bg-gov-grey-100 rounded" />
      </td>
      <td className="px-4 py-3"><div className="h-5 w-14 bg-gov-grey-200 rounded-full" /></td>
      <td className="px-4 py-3"><div className="h-2 w-16 bg-gov-grey-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-16 bg-gov-grey-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-12 bg-gov-grey-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-10 bg-gov-grey-200 rounded" /></td>
    </tr>
  );
}

export function QueueTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gov-grey-100">
            <th className="px-4 py-3 text-left text-xs font-medium text-gov-grey-500 uppercase tracking-wider">Reference</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gov-grey-500 uppercase tracking-wider">Summary</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gov-grey-500 uppercase tracking-wider">Risk</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gov-grey-500 uppercase tracking-wider">Priority</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gov-grey-500 uppercase tracking-wider">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gov-grey-500 uppercase tracking-wider">SLA</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gov-grey-100">
          {Array.from({ length: rows }).map((_, i) => (
            <TableRowSkeleton key={i} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
      <p className="text-sm text-red-700">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-3 btn-secondary text-xs">
          Retry
        </button>
      )}
    </div>
  );
}
