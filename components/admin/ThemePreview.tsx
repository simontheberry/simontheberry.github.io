'use client';

import { Shield, Bell, AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';

interface ThemePreviewProps {
  primaryColor: string;
  secondaryColor: string;
  dangerColor: string;
  successColor: string;
  warningColor: string;
  headerBg: string;
  brandMark: string;
}

export function ThemePreview({
  primaryColor,
  secondaryColor,
  dangerColor,
  successColor,
  warningColor,
  headerBg,
  brandMark,
}: ThemePreviewProps) {
  return (
    <div className="rounded-lg border border-gov-grey-200 overflow-hidden shadow-sm">
      {/* Mini header preview */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ backgroundColor: headerBg }}
      >
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4" style={{ color: brandMark }} />
          <span className="text-xs font-medium text-white">Complaint Triage Platform</span>
        </div>
        <div className="flex items-center gap-2">
          <Bell className="h-3.5 w-3.5 text-white/60" />
          <div
            className="h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-medium text-white"
            style={{ backgroundColor: primaryColor }}
          >
            AD
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="bg-gov-grey-50 p-4 space-y-3">
        {/* Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded px-3 py-1 text-xs font-medium text-white shadow-sm"
            style={{ backgroundColor: primaryColor }}
          >
            Primary
          </button>
          <button
            className="rounded px-3 py-1 text-xs font-medium text-white shadow-sm"
            style={{ backgroundColor: secondaryColor }}
          >
            Secondary
          </button>
          <button
            className="rounded px-3 py-1 text-xs font-medium text-white shadow-sm"
            style={{ backgroundColor: dangerColor }}
          >
            Danger
          </button>
        </div>

        {/* Status badges */}
        <div className="flex flex-wrap gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ backgroundColor: successColor + '20', color: successColor }}
          >
            <CheckCircle className="h-3 w-3" /> Resolved
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ backgroundColor: warningColor + '20', color: warningColor }}
          >
            <AlertTriangle className="h-3 w-3" /> Pending
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ backgroundColor: dangerColor + '20', color: dangerColor }}
          >
            <XCircle className="h-3 w-3" /> Critical
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ backgroundColor: primaryColor + '20', color: primaryColor }}
          >
            <Info className="h-3 w-3" /> Info
          </span>
        </div>

        {/* Mini card */}
        <div className="rounded bg-white p-3 shadow-sm ring-1 ring-gov-grey-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gov-grey-900">CMP-2024-001847</span>
            <span
              className="rounded-full px-1.5 py-0.5 text-[9px] font-medium text-white"
              style={{ backgroundColor: dangerColor }}
            >
              High Risk
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-gov-grey-100 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ backgroundColor: primaryColor, width: '72%' }}
            />
          </div>
          <p className="mt-1 text-[10px] text-gov-grey-500">Priority: 0.82 | Systemic risk detected</p>
        </div>
      </div>
    </div>
  );
}
