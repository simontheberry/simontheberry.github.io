'use client';

import { Edit2, AlertCircle } from 'lucide-react';
import type { IntakeFormState, StepKey } from './IntakeWizard';

interface Props {
  form: IntakeFormState;
  isSubmitting: boolean;
  submitError: string | null;
  onSubmit: () => void;
  onEdit?: (step: StepKey) => void;
}

export function ReviewStep({ form, isSubmitting, submitError, onSubmit, onEdit }: Props) {
  const handleEdit = (step: StepKey) => {
    if (onEdit) {
      onEdit(step);
    }
  };

  return (
    <div className="space-y-6">
      {submitError && (
        <div className="rounded-md bg-gov-red/5 border border-gov-red/20 p-4 flex gap-3">
          <AlertCircle className="h-5 w-5 text-gov-red flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-gov-red">Submission Error</p>
            <p className="text-sm text-gov-red mt-1">{submitError}</p>
          </div>
        </div>
      )}

      {/* Complaint Summary */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gov-grey-900">Your Complaint</h3>
          <button
            onClick={() => handleEdit('describe')}
            className="inline-flex items-center gap-1 text-sm text-gov-blue-600 hover:text-gov-blue-800 font-medium"
          >
            <Edit2 className="h-4 w-4" aria-hidden="true" />
            Edit
          </button>
        </div>
        <div className="rounded-md bg-gov-grey-50 border border-gov-grey-200 p-4">
          <p className="text-sm text-gov-grey-700 whitespace-pre-wrap leading-relaxed">
            {form.rawText}
          </p>
        </div>
      </div>

      {/* Business */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gov-grey-900">Business</h3>
          <button
            onClick={() => handleEdit('business')}
            className="inline-flex items-center gap-1 text-sm text-gov-blue-600 hover:text-gov-blue-800 font-medium"
          >
            <Edit2 className="h-4 w-4" aria-hidden="true" />
            Edit
          </button>
        </div>
        <div className="rounded-md bg-gov-grey-50 border border-gov-grey-200 p-4 space-y-2 text-sm">
          <div>
            <p className="text-gov-grey-500">Name</p>
            <p className="font-medium text-gov-grey-900">{form.business.entityName}</p>
          </div>
          {form.business.abn && (
            <div>
              <p className="text-gov-grey-500">ABN</p>
              <p className="font-mono text-gov-grey-900">{form.business.abn}</p>
            </div>
          )}
          {form.business.entityType && (
            <div>
              <p className="text-gov-grey-500">Entity Type</p>
              <p className="text-gov-grey-900">{form.business.entityType}</p>
            </div>
          )}
        </div>
      </div>

      {/* Incident Date */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gov-grey-900">Incident Date</h3>
          <button
            onClick={() => handleEdit('incident_date')}
            className="inline-flex items-center gap-1 text-sm text-gov-blue-600 hover:text-gov-blue-800 font-medium"
          >
            <Edit2 className="h-4 w-4" aria-hidden="true" />
            Edit
          </button>
        </div>
        <div className="rounded-md bg-gov-grey-50 border border-gov-grey-200 p-4">
          <p className="text-sm text-gov-grey-900">
            {new Date(form.incidentDate).toLocaleDateString('en-AU', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* Complainant */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gov-grey-900">Your Contact Information</h3>
          <button
            onClick={() => handleEdit('contact')}
            className="inline-flex items-center gap-1 text-sm text-gov-blue-600 hover:text-gov-blue-800 font-medium"
          >
            <Edit2 className="h-4 w-4" aria-hidden="true" />
            Edit
          </button>
        </div>
        <div className="rounded-md bg-gov-grey-50 border border-gov-grey-200 p-4 space-y-2 text-sm">
          <div>
            <p className="text-gov-grey-500">Name</p>
            <p className="font-medium text-gov-grey-900">
              {form.complainant.firstName} {form.complainant.lastName}
            </p>
          </div>
          <div>
            <p className="text-gov-grey-500">Email</p>
            <p className="text-gov-grey-900">{form.complainant.email}</p>
          </div>
          {form.complainant.phone && (
            <div>
              <p className="text-gov-grey-500">Phone</p>
              <p className="text-gov-grey-900">{form.complainant.phone}</p>
            </div>
          )}
        </div>
      </div>

      {/* Disclosure */}
      <div className="rounded-md bg-gov-blue-50/50 border border-gov-blue-100 p-4">
        <p className="text-xs text-gov-blue-700">
          By submitting this complaint, you confirm that the information provided is true and correct to the best of your knowledge. Making a false complaint may result in legal action.
        </p>
      </div>
    </div>
  );
}
