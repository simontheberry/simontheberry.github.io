'use client';

import { useCallback } from 'react';
import { FileText, Sparkles } from 'lucide-react';
import { COMPLAINT_CATEGORIES } from '../../src/shared/constants/categories';
import type { IntakeFormState } from './IntakeWizard';

interface Props {
  form: IntakeFormState;
  updateForm: (updater: (prev: IntakeFormState) => IntakeFormState) => void;
}

export function DetailsStep({ form, updateForm }: Props) {
  const characterLimit = 5000;
  const remainingCharacters = characterLimit - form.additionalDetails.length;
  const selectedCategory = form.aiExtracted.category;

  const handleMonetaryValueChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      updateForm((prev) => ({ ...prev, monetaryValue: value }));
    }
  }, [updateForm]);

  const handleAdditionalDetailsChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value.slice(0, characterLimit);
    updateForm((prev) => ({ ...prev, additionalDetails: value }));
  }, [updateForm, characterLimit]);

  return (
    <div>
      <p className="text-sm text-gov-grey-500 mb-6">
        Help us understand the issue better by providing additional details about
        what happened and what impact it had.
      </p>

      <div className="space-y-6">
        {/* Category Selection */}
        <div>
          <label htmlFor="complaint-category" className="block text-sm font-medium text-gov-grey-900 mb-2">
            Complaint category
          </label>
          {form.aiExtracted.suggestedCategory && !selectedCategory && (
            <div className="mb-2 flex items-center gap-2 text-sm text-gov-blue-600">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                AI suggests:{' '}
                <span className="font-medium">
                  {COMPLAINT_CATEGORIES[form.aiExtracted.suggestedCategory as keyof typeof COMPLAINT_CATEGORIES] ||
                    form.aiExtracted.suggestedCategory.replace(/_/g, ' ')}
                </span>
              </span>
            </div>
          )}
          <select
            id="complaint-category"
            value={selectedCategory || ''}
            onChange={(e) =>
              updateForm((prev) => ({
                ...prev,
                aiExtracted: {
                  ...prev.aiExtracted,
                  category: e.target.value || null,
                },
              }))
            }
            className="input-field max-w-md"
          >
            <option value="">Select a category...</option>
            {Object.entries(COMPLAINT_CATEGORIES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Detailed Description */}
        <div>
          <label htmlFor="additional-details" className="block text-sm font-medium text-gov-grey-900 mb-2">
            Additional details <span className="text-gov-grey-400">(optional)</span>
          </label>
          <textarea
            id="additional-details"
            value={form.additionalDetails}
            onChange={handleAdditionalDetailsChange}
            maxLength={characterLimit}
            rows={6}
            className="input-field resize-none w-full"
            placeholder="Any additional information that may help us assess your complaint..."
          />
          <div className="mt-2 flex justify-between items-center">
            <span className="text-xs text-gov-grey-500">
              {form.additionalDetails.length} / {characterLimit} characters
            </span>
            {remainingCharacters <= 200 && remainingCharacters > 0 && (
              <span className="text-xs text-gov-gold">
                {remainingCharacters} characters remaining
              </span>
            )}
          </div>
        </div>

        {/* Monetary Value */}
        <div>
          <label htmlFor="monetary-value" className="block text-sm font-medium text-gov-grey-900 mb-2">
            Amount of financial harm <span className="text-gov-grey-400">(optional)</span>
          </label>
          <div className="relative max-w-xs">
            <span className="absolute left-3 top-3 text-gov-grey-500 font-medium">$</span>
            <input
              type="text"
              id="monetary-value"
              inputMode="decimal"
              value={form.monetaryValue}
              onChange={handleMonetaryValueChange}
              placeholder="0.00"
              className="input-field pl-8 w-full"
            />
          </div>
          <p className="mt-1 text-xs text-gov-grey-500">
            If applicable, let us know the amount of money involved
          </p>
        </div>


        {/* Tips */}
        <div className="rounded-md bg-gov-blue-50/50 border border-gov-blue-100 p-4">
          <div className="flex gap-2">
            <FileText className="h-5 w-5 text-gov-blue-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-sm text-gov-blue-700">
              <p className="font-medium mb-1">Tips for a strong complaint:</p>
              <ul className="text-xs space-y-1 list-disc list-inside">
                <li>Be specific - use dates, names, and amounts where possible</li>
                <li>Stick to facts - avoid emotional language</li>
                <li>Explain the impact - help us understand why this matters</li>
                <li>Document your efforts - mention any attempts to resolve this with the business</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
