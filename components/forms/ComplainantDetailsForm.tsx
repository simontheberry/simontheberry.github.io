'use client';

import { ArrowLeft, ArrowRight } from 'lucide-react';

interface ComplainantData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

interface Props {
  value: ComplainantData;
  onChange: (data: ComplainantData) => void;
  onBack: () => void;
  onNext: () => void;
}

export function ComplainantDetailsForm({ value, onChange, onBack, onNext }: Props) {
  const isValid = value.firstName.trim() && value.lastName.trim() && value.email.includes('@');

  return (
    <div>
      <h2 className="text-lg font-semibold text-gov-grey-900">
        Your Details
      </h2>
      <p className="mt-1 text-sm text-gov-grey-500">
        We need your contact details so we can keep you informed about your complaint.
        Your information will be handled in accordance with our privacy policy.
      </p>

      <div className="mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-gov-grey-700 mb-1">
              First Name <span className="text-gov-red">*</span>
            </label>
            <input
              id="firstName"
              type="text"
              value={value.firstName}
              onChange={(e) => onChange({ ...value, firstName: e.target.value })}
              className="input-field"
              placeholder="First name"
              required
            />
          </div>
          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-gov-grey-700 mb-1">
              Last Name <span className="text-gov-red">*</span>
            </label>
            <input
              id="lastName"
              type="text"
              value={value.lastName}
              onChange={(e) => onChange({ ...value, lastName: e.target.value })}
              className="input-field"
              placeholder="Last name"
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gov-grey-700 mb-1">
            Email Address <span className="text-gov-red">*</span>
          </label>
          <input
            id="email"
            type="email"
            value={value.email}
            onChange={(e) => onChange({ ...value, email: e.target.value })}
            className="input-field"
            placeholder="your.email@example.com"
            required
          />
          <p className="mt-1 text-xs text-gov-grey-400">
            We will send complaint updates to this address.
          </p>
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gov-grey-700 mb-1">
            Phone Number <span className="text-gov-grey-400">(optional)</span>
          </label>
          <input
            id="phone"
            type="tel"
            value={value.phone}
            onChange={(e) => onChange({ ...value, phone: e.target.value })}
            className="input-field"
            placeholder="04XX XXX XXX"
          />
        </div>
      </div>

      {/* Navigation */}
      <div className="mt-8 flex justify-between">
        <button onClick={onBack} className="btn-secondary gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!isValid}
          className="btn-primary gap-2"
        >
          Review Complaint
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
