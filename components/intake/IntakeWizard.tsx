'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Send,
  Loader2,
  CheckCircle2,
  Sparkles,
  MessageSquare,
} from 'lucide-react';
import { DescribeStep } from './DescribeStep';
import { BusinessStep } from './BusinessStep';
import { IncidentDateStep } from './IncidentDateStep';
import { DetailsStep } from './DetailsStep';
import { ContactStep } from './ContactStep';
import { EvidenceUploadStep } from './EvidenceUploadStep';
import { ReviewStep } from './ReviewStep';

const STORAGE_KEY = 'complaint-intake-draft';

export type StepKey =
  | 'describe'
  | 'business'
  | 'incident_date'
  | 'details'
  | 'contact'
  | 'evidence'
  | 'review';

export interface IntakeFormState {
  rawText: string;
  business: {
    name: string;
    abn: string;
    entityName: string;
    entityType: string;
    entityStatus: string;
    website: string;
    industry: string;
    isVerified: boolean;
  };
  complainant: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  incidentDate: string;
  monetaryValue: string;
  additionalDetails: string;
  desiredOutcome: string;
  aiExtracted: {
    category: string | null;
    monetaryValue: number | null;
    incidentDate: string | null;
    keyIssues: string[];
    suggestedCategory: string | null;
    confidence: number;
  };
  evidenceFiles: Array<{
    name: string;
    size: number;
    type: string;
  }>;
  referenceNumber: string | null;
}

const INITIAL_STATE: IntakeFormState = {
  rawText: '',
  business: {
    name: '',
    abn: '',
    entityName: '',
    entityType: '',
    entityStatus: '',
    website: '',
    industry: '',
    isVerified: false,
  },
  complainant: {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  },
  incidentDate: '',
  monetaryValue: '',
  additionalDetails: '',
  desiredOutcome: '',
  aiExtracted: {
    category: null,
    monetaryValue: null,
    incidentDate: null,
    keyIssues: [],
    suggestedCategory: null,
    confidence: 0,
  },
  evidenceFiles: [],
  referenceNumber: null,
};

const STEPS: { key: StepKey; label: string; shortLabel: string }[] = [
  { key: 'describe', label: "What's the issue?", shortLabel: 'Issue' },
  { key: 'business', label: 'Who is the business?', shortLabel: 'Business' },
  { key: 'incident_date', label: 'When did it happen?', shortLabel: 'When' },
  { key: 'details', label: 'Tell us more', shortLabel: 'Details' },
  { key: 'contact', label: 'Your contact info', shortLabel: 'Contact' },
  { key: 'evidence', label: 'Attach evidence', shortLabel: 'Evidence' },
  { key: 'review', label: 'Review and submit', shortLabel: 'Review' },
];

export function IntakeWizard() {
  const [step, setStep] = useState<StepKey>('describe');
  const [form, setForm] = useState<IntakeFormState>(INITIAL_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploadedFileIds, setUploadedFileIds] = useState<string[]>([]);

  // Load draft from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { step: StepKey; form: IntakeFormState };
        if (parsed.form && parsed.step) {
          setForm(parsed.form);
          setStep(parsed.step);
        }
      }
    } catch {
      // Ignore corrupt localStorage data
    }
  }, []);

  // Auto-save draft to localStorage on changes
  useEffect(() => {
    if (step === 'describe' && form.rawText === '') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ step, form }));
    } catch {
      // Ignore storage full errors
    }
  }, [step, form]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  const currentStepIndex = STEPS.findIndex((s) => s.key === step);

  const goNext = useCallback(() => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setStep(STEPS[nextIndex].key);
    }
  }, [currentStepIndex]);

  const goBack = useCallback(() => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setStep(STEPS[prevIndex].key);
    }
  }, [currentStepIndex]);

  const goToStep = useCallback(
    (targetStep: StepKey) => {
      const targetIndex = STEPS.findIndex((s) => s.key === targetStep);
      if (targetIndex <= currentStepIndex) {
        setStep(targetStep);
      }
    },
    [currentStepIndex],
  );

  const updateForm = useCallback(
    (updater: (prev: IntakeFormState) => IntakeFormState) => {
      setForm(updater);
    },
    [],
  );

  async function handleSubmit() {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch('/api/v1/intake/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug: 'default',
          complainant: form.complainant,
          business: form.business,
          complaint: {
            rawText: form.rawText,
            category: form.aiExtracted.category || form.aiExtracted.suggestedCategory,
            monetaryValue: form.monetaryValue
              ? parseFloat(form.monetaryValue)
              : form.aiExtracted.monetaryValue,
            incidentDate: form.incidentDate || form.aiExtracted.incidentDate,
          },
        }),
      });

      const data = await response.json();
      if (data.success) {
        setForm((prev) => ({ ...prev, referenceNumber: data.data.referenceNumber }));
        clearDraft();
      } else {
        setSubmitError(data.error?.message || 'Submission failed. Please try again.');
      }
    } catch {
      setSubmitError('Unable to submit. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  // Submitted state
  if (form.referenceNumber) {
    return (
      <div className="text-center py-16">
        <CheckCircle2 className="h-16 w-16 text-gov-green mx-auto" aria-hidden="true" />
        <h2 className="mt-6 text-2xl font-semibold text-gov-grey-900">
          Complaint Submitted
        </h2>
        <p className="mt-2 text-gov-grey-600">Your reference number is:</p>
        <p className="mt-2 text-xl font-mono font-bold text-gov-blue-500">
          {form.referenceNumber}
        </p>
        <p className="mt-6 text-sm text-gov-grey-500 max-w-md mx-auto">
          We will review your complaint and contact you at the email address
          provided. Please keep your reference number for your records.
        </p>
        <button
          onClick={() => {
            setForm(INITIAL_STATE);
            setStep('describe');
          }}
          className="mt-8 btn-secondary"
        >
          Submit another complaint
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Progress Steps */}
      <nav aria-label="Complaint form progress">
        <ol className="flex items-center mb-8 overflow-x-auto">
          {STEPS.map((s, i) => (
            <li key={s.key} className="flex items-center flex-1 min-w-0">
              <button
                onClick={() => goToStep(s.key)}
                disabled={i > currentStepIndex}
                className="flex items-center min-w-0"
                aria-current={i === currentStepIndex ? 'step' : undefined}
              >
                <span
                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                    i < currentStepIndex
                      ? 'bg-gov-blue-500 text-white'
                      : i === currentStepIndex
                        ? 'bg-gov-blue-500 text-white ring-4 ring-gov-blue-100'
                        : 'bg-gov-grey-200 text-gov-grey-500'
                  }`}
                >
                  {i < currentStepIndex ? (
                    <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    i + 1
                  )}
                </span>
                <span
                  className={`ml-2 text-sm font-medium truncate hidden sm:block ${
                    i <= currentStepIndex ? 'text-gov-grey-900' : 'text-gov-grey-400'
                  }`}
                >
                  {s.shortLabel}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <div
                  className={`mx-2 h-0.5 flex-1 min-w-[16px] ${
                    i < currentStepIndex ? 'bg-gov-blue-500' : 'bg-gov-grey-200'
                  }`}
                  aria-hidden="true"
                />
              )}
            </li>
          ))}
        </ol>
      </nav>

      {/* Step Content */}
      <div className="card p-6">
        {/* Conversational Header */}
        <div className="flex items-center gap-2 mb-6">
          <MessageSquare className="h-5 w-5 text-gov-blue-500" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-gov-grey-900">
            {STEPS[currentStepIndex].label}
          </h2>
          <span className="ml-auto text-xs text-gov-grey-400">
            Step {currentStepIndex + 1} of {STEPS.length}
          </span>
        </div>

        {step === 'describe' && (
          <DescribeStep form={form} updateForm={updateForm} onNext={goNext} />
        )}
        {step === 'business' && (
          <BusinessStep form={form} updateForm={updateForm} />
        )}
        {step === 'incident_date' && (
          <IncidentDateStep form={form} updateForm={updateForm} />
        )}
        {step === 'details' && (
          <DetailsStep form={form} updateForm={updateForm} />
        )}
        {step === 'contact' && (
          <ContactStep form={form} updateForm={updateForm} />
        )}
        {step === 'evidence' && (
          <EvidenceUploadStep
            uploadedFileIds={uploadedFileIds}
            onFileIdsChange={setUploadedFileIds}
          />
        )}
        {step === 'review' && (
          <ReviewStep
            form={form}
            isSubmitting={isSubmitting}
            submitError={submitError}
            onSubmit={handleSubmit}
            onEdit={goToStep}
          />
        )}

        {/* Navigation */}
        <div className="mt-8 flex justify-between border-t border-gov-grey-100 pt-6">
          {currentStepIndex > 0 ? (
            <button onClick={goBack} className="btn-secondary gap-2">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </button>
          ) : (
            <div />
          )}

          {step === 'review' ? (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="btn-primary gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" aria-hidden="true" />
                  Submit Complaint
                </>
              )}
            </button>
          ) : (
            <button onClick={goNext} className="btn-primary gap-2">
              Continue
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Draft indicator */}
      {form.rawText.length > 0 && (
        <div className="mt-4 flex items-center justify-between text-xs text-gov-grey-400">
          <span>Draft auto-saved</span>
          <button
            onClick={() => {
              clearDraft();
              setForm(INITIAL_STATE);
              setStep('describe');
            }}
            className="underline hover:text-gov-grey-600"
          >
            Clear draft
          </button>
        </div>
      )}
    </div>
  );
}
