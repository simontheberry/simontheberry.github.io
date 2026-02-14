'use client';

import { ArrowLeft, Send, Loader2 } from 'lucide-react';

interface Props {
  form: {
    rawText: string;
    business: {
      name: string;
      abn: string;
      entityName: string;
      isVerified: boolean;
    };
    complainant: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
    };
    aiExtracted: {
      category: string | null;
      monetaryValue: number | null;
      incidentDate: string | null;
      keyIssues: string[];
    };
  };
  isSubmitting: boolean;
  onBack: () => void;
  onSubmit: () => void;
}

export function ReviewSubmit({ form, isSubmitting, onBack, onSubmit }: Props) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gov-grey-900">
        Review Your Complaint
      </h2>
      <p className="mt-1 text-sm text-gov-grey-500">
        Please review the details below before submitting.
      </p>

      <div className="mt-6 space-y-6">
        {/* Complaint Description */}
        <ReviewSection title="Complaint Description">
          <p className="text-sm text-gov-grey-700 whitespace-pre-wrap">
            {form.rawText}
          </p>
          {form.aiExtracted.category && (
            <div className="mt-2 text-xs text-gov-grey-500">
              <span className="font-medium">Detected category:</span>{' '}
              {form.aiExtracted.category.replace(/_/g, ' ')}
            </div>
          )}
        </ReviewSection>

        {/* Business */}
        <ReviewSection title="Business">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <div>
              <dt className="text-gov-grey-500">Name</dt>
              <dd className="font-medium">{form.business.entityName || form.business.name}</dd>
            </div>
            {form.business.abn && (
              <div>
                <dt className="text-gov-grey-500">ABN</dt>
                <dd className="font-mono">{form.business.abn}</dd>
              </div>
            )}
          </dl>
          {form.business.isVerified && (
            <span className="mt-2 inline-block text-xs text-gov-green font-medium">
              Verified via ABR
            </span>
          )}
        </ReviewSection>

        {/* Contact Details */}
        <ReviewSection title="Your Details">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <div>
              <dt className="text-gov-grey-500">Name</dt>
              <dd className="font-medium">
                {form.complainant.firstName} {form.complainant.lastName}
              </dd>
            </div>
            <div>
              <dt className="text-gov-grey-500">Email</dt>
              <dd>{form.complainant.email}</dd>
            </div>
            {form.complainant.phone && (
              <div>
                <dt className="text-gov-grey-500">Phone</dt>
                <dd>{form.complainant.phone}</dd>
              </div>
            )}
          </dl>
        </ReviewSection>
      </div>

      {/* Disclaimer */}
      <div className="mt-6 rounded-md bg-gov-grey-50 border border-gov-grey-200 p-4">
        <p className="text-xs text-gov-grey-600 leading-relaxed">
          By submitting this complaint, you confirm that the information provided is
          accurate to the best of your knowledge. Your complaint will be assessed and
          triaged by our team. We will contact you at the email address provided with
          updates on the progress of your complaint.
        </p>
      </div>

      {/* Navigation */}
      <div className="mt-8 flex justify-between">
        <button onClick={onBack} className="btn-secondary gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <button
          onClick={onSubmit}
          disabled={isSubmitting}
          className="btn-primary gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Submit Complaint
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function ReviewSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-gov-grey-100 pb-4">
      <h3 className="text-sm font-medium text-gov-grey-900 mb-2">{title}</h3>
      {children}
    </div>
  );
}
