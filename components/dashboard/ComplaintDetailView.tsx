'use client';

import {
  ArrowLeft,
  Clock,
  Building2,
  User,
  Sparkles,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import { useApi } from '../hooks/useApi';
import { ErrorState } from './LoadingSkeleton';
import { CommunicationDraftPanel } from './CommunicationDraftPanel';
import { COMPLAINT_CATEGORIES, RISK_LEVEL_CONFIG, STATUS_LABELS, ROUTING_LABELS } from '../../src/shared/constants/categories';
import type { ComplaintData } from '../../src/shared/types/complaint';

interface Props {
  complaintId: string;
}

export function ComplaintDetailView({ complaintId }: Props) {
  const { data: complaint, isLoading, error, refetch } = useApi<ComplaintData>(
    `/api/v1/complaints/${complaintId}`
  );

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-6 w-48 bg-gov-grey-200 rounded" />
        <div className="card p-6 space-y-4">
          <div className="h-5 w-64 bg-gov-grey-200 rounded" />
          <div className="h-4 w-full bg-gov-grey-100 rounded" />
          <div className="h-4 w-3/4 bg-gov-grey-100 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={refetch} />;
  }

  if (!complaint) {
    return (
      <div className="card p-12 text-center text-sm text-gov-grey-400">
        Complaint not found.
      </div>
    );
  }

  const riskConfig = complaint.riskLevel
    ? RISK_LEVEL_CONFIG[complaint.riskLevel]
    : null;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/dashboard/complaints"
          className="inline-flex items-center gap-1 text-sm text-gov-grey-500 hover:text-gov-grey-700"
        >
          <ArrowLeft className="h-4 w-4" />
          All Complaints
        </Link>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gov-grey-900 font-mono">
            {complaint.referenceNumber}
          </h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-gov-grey-500">
            <span>{STATUS_LABELS[complaint.status] || complaint.status}</span>
            {complaint.riskLevel && riskConfig && (
              <span className={`badge badge-${complaint.riskLevel}`}>
                {riskConfig.label}
              </span>
            )}
            {complaint.priorityScore !== undefined && (
              <span className="font-mono text-xs">
                Priority: {(complaint.priorityScore * 100).toFixed(0)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Complaint Text */}
          <div className="card">
            <div className="p-4 border-b border-gov-grey-100 flex items-center gap-2">
              <FileText className="h-4 w-4 text-gov-grey-500" />
              <h2 className="font-medium text-gov-grey-900">Complaint Description</h2>
            </div>
            <div className="p-5">
              <p className="text-sm text-gov-grey-700 whitespace-pre-wrap leading-relaxed">
                {complaint.rawText}
              </p>
              {complaint.aiSummary && (
                <div className="mt-4 rounded-md bg-gov-blue-50/50 border border-gov-blue-100 p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Sparkles className="h-3.5 w-3.5 text-gov-blue-500" />
                    <span className="text-xs font-medium text-gov-blue-700">AI Summary</span>
                    {complaint.aiConfidence !== undefined && (
                      <span className="ml-auto text-xs text-gov-grey-500">
                        {Math.round(complaint.aiConfidence * 100)}% confidence
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gov-blue-600">{complaint.aiSummary}</p>
                </div>
              )}
            </div>
          </div>

          {/* Triage Result */}
          {complaint.triageResult && (
            <div className="card">
              <div className="p-4 border-b border-gov-grey-100 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-gov-blue-500" />
                <h2 className="font-medium text-gov-grey-900">Triage Result</h2>
                <span className="ml-auto text-xs text-gov-grey-500">
                  {Math.round(complaint.triageResult.confidence * 100)}% confidence
                </span>
              </div>
              <div className="p-5 space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gov-grey-500">Category</span>
                    <p className="font-medium">
                      {COMPLAINT_CATEGORIES[complaint.triageResult.category as keyof typeof COMPLAINT_CATEGORIES] || complaint.triageResult.category}
                    </p>
                  </div>
                  <div>
                    <span className="text-gov-grey-500">Legal Category</span>
                    <p className="font-medium">{complaint.triageResult.legalCategory}</p>
                  </div>
                  <div>
                    <span className="text-gov-grey-500">Risk Level</span>
                    <p><span className={`badge badge-${complaint.triageResult.riskLevel}`}>{complaint.triageResult.riskLevel}</span></p>
                  </div>
                  <div>
                    <span className="text-gov-grey-500">Routing</span>
                    <p className="font-medium text-xs">
                      {ROUTING_LABELS[complaint.triageResult.routingDestination as keyof typeof ROUTING_LABELS] || complaint.triageResult.routingDestination}
                    </p>
                  </div>
                </div>
                {complaint.triageResult.reasoning && (
                  <div className="mt-2 text-sm text-gov-grey-600 border-t border-gov-grey-100 pt-3">
                    <span className="text-xs font-medium text-gov-grey-500 uppercase tracking-wide">Reasoning</span>
                    <p className="mt-1">{complaint.triageResult.reasoning}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Communication Draft */}
          <CommunicationDraftPanel
            complaintId={complaint.id}
            referenceNumber={complaint.referenceNumber}
            onDraftSent={refetch}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Business Details */}
          <div className="card">
            <div className="p-4 border-b border-gov-grey-100 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-gov-grey-500" />
              <h3 className="font-medium text-gov-grey-900">Business</h3>
            </div>
            <div className="p-4 text-sm space-y-2">
              <p className="font-medium text-gov-grey-900">{complaint.business.name}</p>
              {complaint.business.abn && (
                <p className="text-gov-grey-500">ABN: <span className="font-mono">{complaint.business.abn}</span></p>
              )}
              {complaint.business.industry && (
                <p className="text-gov-grey-500">Industry: {complaint.business.industry}</p>
              )}
              {complaint.business.isVerified && (
                <span className="text-xs text-gov-green font-medium">Verified via ABR</span>
              )}
            </div>
          </div>

          {/* Complainant Details */}
          <div className="card">
            <div className="p-4 border-b border-gov-grey-100 flex items-center gap-2">
              <User className="h-4 w-4 text-gov-grey-500" />
              <h3 className="font-medium text-gov-grey-900">Complainant</h3>
            </div>
            <div className="p-4 text-sm space-y-2">
              <p className="font-medium text-gov-grey-900">
                {complaint.complainant.firstName} {complaint.complainant.lastName}
              </p>
              <p className="text-gov-grey-500">{complaint.complainant.email}</p>
              {complaint.complainant.phone && (
                <p className="text-gov-grey-500">{complaint.complainant.phone}</p>
              )}
            </div>
          </div>

          {/* Key Dates */}
          <div className="card">
            <div className="p-4 border-b border-gov-grey-100 flex items-center gap-2">
              <Clock className="h-4 w-4 text-gov-grey-500" />
              <h3 className="font-medium text-gov-grey-900">Key Dates</h3>
            </div>
            <div className="p-4 text-sm space-y-2">
              {complaint.submittedAt && (
                <div className="flex justify-between">
                  <span className="text-gov-grey-500">Submitted</span>
                  <span>{new Date(complaint.submittedAt).toLocaleDateString()}</span>
                </div>
              )}
              {complaint.incidentDate && (
                <div className="flex justify-between">
                  <span className="text-gov-grey-500">Incident</span>
                  <span>{new Date(complaint.incidentDate).toLocaleDateString()}</span>
                </div>
              )}
              {complaint.slaDeadline && (
                <div className="flex justify-between">
                  <span className="text-gov-grey-500">SLA Deadline</span>
                  <span className={new Date(complaint.slaDeadline) < new Date() ? 'text-gov-red font-medium' : ''}>
                    {new Date(complaint.slaDeadline).toLocaleDateString()}
                  </span>
                </div>
              )}
              {complaint.monetaryValue !== undefined && complaint.monetaryValue !== null && (
                <div className="flex justify-between">
                  <span className="text-gov-grey-500">Amount</span>
                  <span className="font-medium">${Number(complaint.monetaryValue).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Systemic Risk */}
          {complaint.systemicClusterId && (
            <div className="card border-yellow-200">
              <div className="p-4 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium text-gov-grey-900">Part of Systemic Cluster</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
