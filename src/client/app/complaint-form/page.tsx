'use client';

import { useState } from 'react';
import { Shield, Send, Loader2, Building2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ComplaintTextInput } from '../../components/forms/ComplaintTextInput';
import { BusinessLookup } from '../../components/forms/BusinessLookup';
import { AiGuidancePanel } from '../../components/forms/AiGuidancePanel';
import { ComplainantDetailsForm } from '../../components/forms/ComplainantDetailsForm';
import { ReviewSubmit } from '../../components/forms/ReviewSubmit';

type Step = 'describe' | 'business' | 'details' | 'review' | 'submitted';

interface FormState {
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
  aiExtracted: {
    category: string | null;
    monetaryValue: number | null;
    incidentDate: string | null;
    keyIssues: string[];
  };
  referenceNumber: string | null;
}

const INITIAL_STATE: FormState = {
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
  aiExtracted: {
    category: null,
    monetaryValue: null,
    incidentDate: null,
    keyIssues: [],
  },
  referenceNumber: null,
};

export default function ComplaintFormPage() {
  const [step, setStep] = useState<Step>('describe');
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const steps: { key: Step; label: string }[] = [
    { key: 'describe', label: 'Describe Issue' },
    { key: 'business', label: 'Business Details' },
    { key: 'details', label: 'Your Details' },
    { key: 'review', label: 'Review & Submit' },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === step);

  async function handleSubmit() {
    setIsSubmitting(true);
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
            category: form.aiExtracted.category,
            monetaryValue: form.aiExtracted.monetaryValue,
            incidentDate: form.aiExtracted.incidentDate,
          },
        }),
      });

      const data = await response.json();
      if (data.success) {
        setForm((prev) => ({ ...prev, referenceNumber: data.data.referenceNumber }));
        setStep('submitted');
      }
    } catch (error) {
      console.error('Submission failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (step === 'submitted') {
    return (
      <FormShell>
        <div className="text-center py-16">
          <CheckCircle2 className="h-16 w-16 text-gov-green mx-auto" />
          <h2 className="mt-6 text-2xl font-semibold text-gov-grey-900">
            Complaint Submitted
          </h2>
          <p className="mt-2 text-gov-grey-600">
            Your reference number is:
          </p>
          <p className="mt-2 text-xl font-mono font-bold text-gov-blue-500">
            {form.referenceNumber}
          </p>
          <p className="mt-6 text-sm text-gov-grey-500 max-w-md mx-auto">
            We will review your complaint and contact you at the email address
            provided. Please keep your reference number for your records.
          </p>
        </div>
      </FormShell>
    );
  }

  return (
    <FormShell>
      {/* Progress Steps */}
      <nav className="mb-8">
        <ol className="flex items-center">
          {steps.map((s, i) => (
            <li key={s.key} className="flex items-center flex-1">
              <div className="flex items-center">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                    i < currentStepIndex
                      ? 'bg-gov-blue-500 text-white'
                      : i === currentStepIndex
                        ? 'bg-gov-blue-500 text-white ring-4 ring-gov-blue-100'
                        : 'bg-gov-grey-200 text-gov-grey-500'
                  }`}
                >
                  {i < currentStepIndex ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    i + 1
                  )}
                </span>
                <span
                  className={`ml-3 text-sm font-medium ${
                    i <= currentStepIndex ? 'text-gov-grey-900' : 'text-gov-grey-400'
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`mx-4 h-0.5 flex-1 ${
                    i < currentStepIndex ? 'bg-gov-blue-500' : 'bg-gov-grey-200'
                  }`}
                />
              )}
            </li>
          ))}
        </ol>
      </nav>

      {/* Step Content */}
      <div className="card p-6">
        {step === 'describe' && (
          <ComplaintTextInput
            value={form.rawText}
            onChange={(text) => setForm((prev) => ({ ...prev, rawText: text }))}
            onAiExtraction={(extracted) =>
              setForm((prev) => ({ ...prev, aiExtracted: { ...prev.aiExtracted, ...extracted } }))
            }
            onNext={() => setStep('business')}
          />
        )}

        {step === 'business' && (
          <BusinessLookup
            value={form.business}
            onChange={(business) => setForm((prev) => ({ ...prev, business }))}
            onBack={() => setStep('describe')}
            onNext={() => setStep('details')}
          />
        )}

        {step === 'details' && (
          <ComplainantDetailsForm
            value={form.complainant}
            onChange={(complainant) => setForm((prev) => ({ ...prev, complainant }))}
            onBack={() => setStep('business')}
            onNext={() => setStep('review')}
          />
        )}

        {step === 'review' && (
          <ReviewSubmit
            form={form}
            isSubmitting={isSubmitting}
            onBack={() => setStep('details')}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </FormShell>
  );
}

function FormShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gov-grey-50">
      <header className="bg-gov-navy">
        <div className="mx-auto max-w-3xl px-6 py-4 flex items-center gap-3">
          <Shield className="h-7 w-7 text-gov-gold" />
          <div>
            <h1 className="text-base font-semibold text-white">Submit a Complaint</h1>
            <p className="text-xs text-white/60">Consumer Protection Regulator</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8">{children}</main>
    </div>
  );
}
