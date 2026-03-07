'use client';

import { useState, useCallback } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { AiGuidancePanel } from '../forms/AiGuidancePanel';
import type { IntakeFormState } from './IntakeWizard';

interface AiGuidance {
  extractedData: Record<string, unknown>;
  missingFields: Array<{ field: string; importance: string; question: string }>;
  followUpQuestions: string[];
  completenessScore: number;
  confidence: number;
}

interface Props {
  form: IntakeFormState;
  updateForm: (updater: (prev: IntakeFormState) => IntakeFormState) => void;
  onNext: () => void;
}

export function DescribeStep({ form, updateForm, onNext }: Props) {
  const [guidance, setGuidance] = useState<AiGuidance | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  const analyzeText = useCallback(async () => {
    if (form.rawText.length < 20) return;

    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/v1/intake/ai-guidance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantSlug: 'default', text: form.rawText }),
      });

      const data = await response.json();
      if (data.success) {
        setGuidance(data.data);
        const extracted = data.data.extractedData as Record<string, unknown>;
        updateForm((prev) => ({
          ...prev,
          aiExtracted: {
            ...prev.aiExtracted,
            ...extracted,
            suggestedCategory: (extracted.category as string) || null,
            confidence: data.data.confidence || 0,
          },
        }));
        setHasAnalyzed(true);
      }
    } catch {
      // AI guidance is optional, fail silently
    } finally {
      setIsAnalyzing(false);
    }
  }, [form.rawText, updateForm]);

  return (
    <div>
      <p className="text-sm text-gov-grey-500 mb-4">
        Describe your complaint in your own words. Include what happened, who was
        involved, and what outcome you are seeking. Our AI will help identify key
        details.
      </p>

      <div>
        <label htmlFor="complaint-text" className="sr-only">
          Complaint description
        </label>
        <textarea
          id="complaint-text"
          value={form.rawText}
          onChange={(e) =>
            updateForm((prev) => ({ ...prev, rawText: e.target.value }))
          }
          rows={8}
          className="input-field resize-none"
          placeholder="Describe what happened, including the business involved, dates, amounts, and what you'd like resolved..."
        />

        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-gov-grey-400">
            {form.rawText.length} characters
            {form.rawText.length < 20 && form.rawText.length > 0 && (
              <span className="ml-2 text-gov-grey-500">
                (minimum 20 characters)
              </span>
            )}
          </span>
          {form.rawText.length >= 20 && !isAnalyzing && (
            <button
              onClick={analyzeText}
              className="inline-flex items-center gap-1.5 text-sm text-gov-blue-500 hover:text-gov-blue-700 font-medium"
              aria-label={hasAnalyzed ? 'Re-analyze complaint text with AI' : 'Analyze complaint text with AI'}
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {hasAnalyzed ? 'Re-analyze' : 'Analyze with AI'}
            </button>
          )}
          {isAnalyzing && (
            <span className="inline-flex items-center gap-1.5 text-sm text-gov-grey-500" role="status">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Analyzing...
            </span>
          )}
        </div>
      </div>

      {guidance && <AiGuidancePanel guidance={guidance} />}

      {/* AI category suggestion */}
      {form.aiExtracted.suggestedCategory && (
        <div className="mt-4 rounded-md border border-gov-blue-200 bg-gov-blue-50/50 p-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gov-blue-500" aria-hidden="true" />
            <p className="text-sm text-gov-blue-700">
              This looks like{' '}
              <span className="font-medium">
                {form.aiExtracted.suggestedCategory.replace(/_/g, ' ')}
              </span>
              . Is that correct?
            </p>
          </div>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() =>
                updateForm((prev) => ({
                  ...prev,
                  aiExtracted: {
                    ...prev.aiExtracted,
                    category: prev.aiExtracted.suggestedCategory,
                  },
                }))
              }
              className="text-xs font-medium text-gov-blue-600 hover:text-gov-blue-800 underline"
            >
              Yes, that is correct
            </button>
            <span className="text-gov-grey-300">|</span>
            <button
              onClick={() =>
                updateForm((prev) => ({
                  ...prev,
                  aiExtracted: {
                    ...prev.aiExtracted,
                    suggestedCategory: null,
                  },
                }))
              }
              className="text-xs font-medium text-gov-grey-500 hover:text-gov-grey-700 underline"
            >
              No, dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
