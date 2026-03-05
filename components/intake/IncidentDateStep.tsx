'use client';

import { Calendar } from 'lucide-react';
import type { IntakeFormState } from './IntakeWizard';

interface Props {
  form: IntakeFormState;
  updateForm: (updater: (prev: IntakeFormState) => IntakeFormState) => void;
}

export function IncidentDateStep({ form, updateForm }: Props) {
  const today = new Date().toISOString().split('T')[0];

  // Max date is today, min date is 10 years ago
  const minDate = new Date();
  minDate.setFullYear(minDate.getFullYear() - 10);
  const minDateString = minDate.toISOString().split('T')[0];

  return (
    <div>
      <p className="text-sm text-gov-grey-500 mb-6">
        When did the incident occur? We ask this to help track patterns and set appropriate timelines for our review.
      </p>

      <div className="space-y-4">
        <div>
          <label htmlFor="incident-date" className="block text-sm font-medium text-gov-grey-900 mb-2">
            Date of incident
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-3 h-5 w-5 text-gov-grey-400 pointer-events-none" aria-hidden="true" />
            <input
              type="date"
              id="incident-date"
              value={form.incidentDate}
              onChange={(e) =>
                updateForm((prev) => ({ ...prev, incidentDate: e.target.value }))
              }
              min={minDateString}
              max={today}
              className="input-field pl-10 w-full"
              required
            />
          </div>
          <p className="mt-1 text-xs text-gov-grey-500">
            Select a date within the last 10 years
          </p>
        </div>

        {form.incidentDate && (
          <div className="rounded-md bg-gov-blue-50/50 border border-gov-blue-100 p-3">
            <p className="text-sm text-gov-blue-700">
              Incident date: <span className="font-medium">
                {new Date(form.incidentDate).toLocaleDateString('en-AU', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </p>
          </div>
        )}

        {/* Optional: Show approximate age of incident */}
        {form.incidentDate && (
          <div className="text-xs text-gov-grey-600">
            {(() => {
              const incident = new Date(form.incidentDate);
              const now = new Date();
              const days = Math.floor((now.getTime() - incident.getTime()) / (1000 * 60 * 60 * 24));
              const months = Math.floor(days / 30);
              const years = Math.floor(days / 365);

              if (years > 0) {
                return `${years} year${years !== 1 ? 's' : ''} ago`;
              } else if (months > 0) {
                return `${months} month${months !== 1 ? 's' : ''} ago`;
              } else {
                return `${days} day${days !== 1 ? 's' : ''} ago`;
              }
            })()}
          </div>
        )}
      </div>

      {/* Help text */}
      <div className="mt-6 p-4 rounded-md bg-gov-grey-50 border border-gov-grey-100">
        <p className="text-xs font-medium text-gov-grey-700 mb-2">Need help?</p>
        <ul className="text-xs text-gov-grey-600 space-y-1 list-disc list-inside">
          <li>Use your purchase receipt, email, or transaction details to find the date</li>
          <li>If you're unsure of the exact date, select your best estimate</li>
          <li>We can discuss exact timing during our investigation</li>
        </ul>
      </div>
    </div>
  );
}
