'use client';

import { Sparkles, AlertCircle, CheckCircle2, Info } from 'lucide-react';

interface AiGuidance {
  extractedData: Record<string, unknown>;
  missingFields: Array<{ field: string; importance: string; question: string }>;
  followUpQuestions: string[];
  completenessScore: number;
  confidence: number;
}

interface Props {
  guidance: AiGuidance;
}

const IMPORTANCE_STYLES = {
  critical: 'border-red-200 bg-red-50 text-red-800',
  important: 'border-yellow-200 bg-yellow-50 text-yellow-800',
  helpful: 'border-blue-200 bg-blue-50 text-blue-800',
};

const IMPORTANCE_ICONS = {
  critical: <AlertCircle className="h-4 w-4 text-red-500" />,
  important: <Info className="h-4 w-4 text-yellow-500" />,
  helpful: <Info className="h-4 w-4 text-blue-500" />,
};

export function AiGuidancePanel({ guidance }: Props) {
  const extractedEntries = Object.entries(guidance.extractedData).filter(
    ([, v]) => v !== null && v !== undefined,
  );

  return (
    <div className="mt-6 rounded-lg border border-gov-blue-200 bg-gov-blue-50/30 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-4 w-4 text-gov-blue-500" />
        <span className="text-sm font-medium text-gov-blue-700">AI Analysis</span>
        {guidance.confidence > 0 && (
          <span className="ml-auto text-xs text-gov-grey-500">
            {Math.round(guidance.confidence * 100)}% confidence
          </span>
        )}
      </div>

      {/* Extracted data */}
      {extractedEntries.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gov-grey-600 uppercase tracking-wide mb-2">
            Detected Information
          </p>
          <div className="grid grid-cols-2 gap-2">
            {extractedEntries.map(([key, value]) => (
              <div key={key} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-gov-green" />
                <span className="text-sm text-gov-grey-700">
                  <span className="font-medium">{formatFieldName(key)}:</span>{' '}
                  {String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Missing fields */}
      {guidance.missingFields.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gov-grey-600 uppercase tracking-wide mb-2">
            Additional Information Needed
          </p>
          <div className="space-y-2">
            {guidance.missingFields.map((field) => (
              <div
                key={field.field}
                className={`flex items-start gap-2 rounded-md border p-3 ${
                  IMPORTANCE_STYLES[field.importance as keyof typeof IMPORTANCE_STYLES] ||
                  IMPORTANCE_STYLES.helpful
                }`}
              >
                {IMPORTANCE_ICONS[field.importance as keyof typeof IMPORTANCE_ICONS] ||
                  IMPORTANCE_ICONS.helpful}
                <p className="text-sm">{field.question}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completeness score */}
      {guidance.completenessScore > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-gov-grey-500 mb-1">
            <span>Completeness</span>
            <span>{Math.round(guidance.completenessScore * 100)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-gov-grey-200">
            <div
              className="h-1.5 rounded-full bg-gov-blue-500 transition-all"
              style={{ width: `${guidance.completenessScore * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function formatFieldName(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}
