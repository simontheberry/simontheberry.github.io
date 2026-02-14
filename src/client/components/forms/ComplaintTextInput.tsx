'use client';

import { useState, useCallback } from 'react';
import { Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { AiGuidancePanel } from './AiGuidancePanel';

interface AiGuidance {
  extractedData: Record<string, unknown>;
  missingFields: Array<{ field: string; importance: string; question: string }>;
  followUpQuestions: string[];
  completenessScore: number;
  confidence: number;
}

interface Props {
  value: string;
  onChange: (text: string) => void;
  onAiExtraction: (data: Record<string, unknown>) => void;
  onNext: () => void;
}

export function ComplaintTextInput({ value, onChange, onAiExtraction, onNext }: Props) {
  const [guidance, setGuidance] = useState<AiGuidance | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  const analyzeText = useCallback(async () => {
    if (value.length < 20) return;

    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/v1/intake/ai-guidance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantSlug: 'default', text: value }),
      });

      const data = await response.json();
      if (data.success) {
        setGuidance(data.data);
        onAiExtraction(data.data.extractedData);
        setHasAnalyzed(true);
      }
    } catch (error) {
      console.error('AI guidance failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [value, onAiExtraction]);

  return (
    <div>
      <h2 className="text-lg font-semibold text-gov-grey-900">
        Tell us what happened
      </h2>
      <p className="mt-1 text-sm text-gov-grey-500">
        Describe your complaint in your own words. Our system will help identify
        key details and ask any follow-up questions.
      </p>

      <div className="mt-6">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={8}
          className="input-field resize-none"
          placeholder="Describe what happened, including the business involved, dates, amounts, and what you'd like resolved..."
        />

        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-gov-grey-400">
            {value.length} characters
          </span>
          {value.length >= 20 && !isAnalyzing && (
            <button
              onClick={analyzeText}
              className="inline-flex items-center gap-1.5 text-sm text-gov-blue-500 hover:text-gov-blue-700 font-medium"
            >
              <Sparkles className="h-4 w-4" />
              {hasAnalyzed ? 'Re-analyze' : 'Analyze with AI'}
            </button>
          )}
          {isAnalyzing && (
            <span className="inline-flex items-center gap-1.5 text-sm text-gov-grey-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing...
            </span>
          )}
        </div>
      </div>

      {/* AI Guidance Panel */}
      {guidance && <AiGuidancePanel guidance={guidance} />}

      {/* Navigation */}
      <div className="mt-8 flex justify-end">
        <button
          onClick={onNext}
          disabled={value.length < 20}
          className="btn-primary gap-2"
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
