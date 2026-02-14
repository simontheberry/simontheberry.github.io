'use client';

const COLOR_MAP = {
  blue: 'bg-blue-50 text-blue-600',
  yellow: 'bg-yellow-50 text-yellow-600',
  orange: 'bg-orange-50 text-orange-600',
  green: 'bg-green-50 text-green-600',
  red: 'bg-red-50 text-red-600',
  grey: 'bg-gov-grey-50 text-gov-grey-600',
};

interface Props {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: keyof typeof COLOR_MAP;
  trend?: { value: number; direction: 'up' | 'down' };
}

export function StatsCard({ label, value, icon, color, trend }: Props) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div className={`rounded-lg p-2 ${COLOR_MAP[color]}`}>
          {icon}
        </div>
        {trend && (
          <span
            className={`text-xs font-medium ${
              trend.direction === 'up' ? 'text-red-600' : 'text-green-600'
            }`}
          >
            {trend.direction === 'up' ? '+' : '-'}{trend.value}%
          </span>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-semibold text-gov-grey-900">{value}</p>
        <p className="text-sm text-gov-grey-500">{label}</p>
      </div>
    </div>
  );
}
