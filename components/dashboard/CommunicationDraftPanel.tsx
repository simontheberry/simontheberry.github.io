'use client';

import { useState } from 'react';
import { Sparkles, Send, Edit3, AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { useApiMutation } from '../hooks/useApi';

interface CommunicationDraft {
  communicationId: string;
  complaintId: string;
  type: 'response_to_complainant' | 'notice_to_business' | 'escalation_notice';
  subject: string;
  body: string;
  isAiDrafted: boolean;
  confidence: number;
  reasoning?: string;
  modelUsed?: string;
}

interface Props {
  complaintId: string;
  referenceNumber: string;
  onDraftSent?: () => void;
}

const DRAFT_TYPE_LABELS = {
  response_to_complainant: 'Response to Complainant',
  notice_to_business: 'Notice to Business',
  escalation_notice: 'Escalation Notice',
} as const;

export function CommunicationDraftPanel({ complaintId, referenceNumber, onDraftSent }: Props) {
  const [selectedType, setSelectedType] = useState<CommunicationDraft['type']>('response_to_complainant');
  const [draft, setDraft] = useState<CommunicationDraft | null>(null);
  const [editedBody, setEditedBody] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  const { mutate: generateDraft, isLoading: isGenerating, error: generateError } = useApiMutation<
    { complaintId: string; type: string },
    CommunicationDraft
  >();

  const { mutate: sendDraft, isLoading: isSending, error: sendError } = useApiMutation<
    { communicationId: string }
  >();

  async function handleGenerate() {
    setSendSuccess(false);
    setDraft(null);

    const result = await generateDraft('/api/v1/communications/draft', 'POST', {
      complaintId,
      type: selectedType,
    });

    if (result) {
      setDraft(result);
      setEditedBody(result.body);
      setIsEditing(false);
    }
  }

  async function handleSend() {
    if (!draft) return;

    const result = await sendDraft('/api/v1/communications/send', 'POST', {
      communicationId: draft.communicationId,
    });

    if (result) {
      setSendSuccess(true);
      onDraftSent?.();
    }
  }

  const confidenceLevel = draft
    ? draft.confidence >= 0.85 ? 'high' : draft.confidence >= 0.70 ? 'medium' : 'low'
    : null;

  return (
    <div className="card">
      <div className="p-4 border-b border-gov-grey-100 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-gov-blue-500" />
        <h2 className="font-medium text-gov-grey-900">AI Communication Draft</h2>
        <span className="ml-auto text-xs text-gov-grey-500 font-mono">{referenceNumber}</span>
      </div>

      <div className="p-5 space-y-4">
        {/* Draft Type Selection */}
        <div>
          <label className="block text-sm font-medium text-gov-grey-700 mb-2">
            Communication Type
          </label>
          <div className="flex gap-2">
            {(Object.entries(DRAFT_TYPE_LABELS) as Array<[CommunicationDraft['type'], string]>).map(
              ([key, label]) => (
                <button
                  key={key}
                  onClick={() => {
                    setSelectedType(key);
                    setDraft(null);
                    setSendSuccess(false);
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    selectedType === key
                      ? 'bg-gov-blue-500 text-white'
                      : 'bg-gov-grey-100 text-gov-grey-600 hover:bg-gov-grey-200'
                  }`}
                >
                  {label}
                </button>
              ),
            )}
          </div>
        </div>

        {/* Generate Button */}
        {!draft && !isGenerating && (
          <button
            onClick={handleGenerate}
            className="btn-primary gap-2 w-full justify-center"
          >
            <Sparkles className="h-4 w-4" />
            Generate Draft
          </button>
        )}

        {isGenerating && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-gov-grey-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating AI draft...
          </div>
        )}

        {generateError && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {generateError}
          </div>
        )}

        {/* Draft Content */}
        {draft && (
          <div className="space-y-4">
            {/* Confidence Indicator */}
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-1.5 text-xs font-medium ${
                confidenceLevel === 'high' ? 'text-gov-green' :
                confidenceLevel === 'medium' ? 'text-yellow-600' :
                'text-gov-red'
              }`}>
                {confidenceLevel === 'high' ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5" />
                )}
                {Math.round(draft.confidence * 100)}% confidence
              </div>
              {confidenceLevel === 'low' && (
                <span className="text-xs text-gov-red">
                  Below supervisor review threshold -- requires manual review
                </span>
              )}
              {draft.modelUsed && (
                <span className="ml-auto text-xs text-gov-grey-400">
                  {draft.modelUsed}
                </span>
              )}
            </div>

            {/* AI Reasoning */}
            {draft.reasoning && (
              <div className="rounded-md bg-gov-blue-50/50 border border-gov-blue-100 p-3">
                <p className="text-xs font-medium text-gov-blue-700 mb-1">AI Reasoning</p>
                <p className="text-sm text-gov-blue-600">{draft.reasoning}</p>
              </div>
            )}

            {/* Subject */}
            <div>
              <label className="block text-xs font-medium text-gov-grey-500 uppercase tracking-wide mb-1">
                Subject
              </label>
              <p className="text-sm text-gov-grey-900 font-medium">{draft.subject}</p>
            </div>

            {/* Body */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-gov-grey-500 uppercase tracking-wide">
                  Body
                </label>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="inline-flex items-center gap-1 text-xs text-gov-blue-500 hover:text-gov-blue-700 font-medium"
                >
                  <Edit3 className="h-3 w-3" />
                  {isEditing ? 'Preview' : 'Edit'}
                </button>
              </div>
              {isEditing ? (
                <textarea
                  value={editedBody}
                  onChange={(e) => setEditedBody(e.target.value)}
                  rows={10}
                  className="input-field resize-none font-mono text-sm"
                />
              ) : (
                <div className="rounded-md border border-gov-grey-200 bg-white p-4 text-sm text-gov-grey-700 whitespace-pre-wrap">
                  {editedBody}
                </div>
              )}
            </div>

            {/* Actions */}
            {sendSuccess ? (
              <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                Communication sent successfully
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="btn-secondary gap-1.5 text-sm"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Regenerate
                </button>
                <button
                  onClick={handleSend}
                  disabled={isSending || !editedBody.trim()}
                  className="btn-primary gap-1.5 text-sm ml-auto"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      Approve & Send
                    </>
                  )}
                </button>
              </div>
            )}

            {sendError && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {sendError}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
