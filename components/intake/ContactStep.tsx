'use client';

import { Mail, Phone, User } from 'lucide-react';
import type { IntakeFormState } from './IntakeWizard';

interface Props {
  form: IntakeFormState;
  updateForm: (updater: (prev: IntakeFormState) => IntakeFormState) => void;
}

export function ContactStep({ form, updateForm }: Props) {
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateForm((prev) => ({
      ...prev,
      complainant: { ...prev.complainant, email: e.target.value },
    }));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateForm((prev) => ({
      ...prev,
      complainant: { ...prev.complainant, phone: e.target.value },
    }));
  };

  const handleFirstNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateForm((prev) => ({
      ...prev,
      complainant: { ...prev.complainant, firstName: e.target.value },
    }));
  };

  const handleLastNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateForm((prev) => ({
      ...prev,
      complainant: { ...prev.complainant, lastName: e.target.value },
    }));
  };

  return (
    <div>
      <p className="text-sm text-gov-grey-500 mb-6">
        We need your contact details so we can reach you about your complaint and provide you with a reference number.
      </p>

      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* First Name */}
          <div>
            <label htmlFor="first-name" className="block text-sm font-medium text-gov-grey-900 mb-2">
              First name <span className="text-gov-red">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-5 w-5 text-gov-grey-400 pointer-events-none" aria-hidden="true" />
              <input
                type="text"
                id="first-name"
                value={form.complainant.firstName}
                onChange={handleFirstNameChange}
                className="input-field pl-10 w-full"
                placeholder="John"
                required
              />
            </div>
          </div>

          {/* Last Name */}
          <div>
            <label htmlFor="last-name" className="block text-sm font-medium text-gov-grey-900 mb-2">
              Last name <span className="text-gov-red">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-5 w-5 text-gov-grey-400 pointer-events-none" aria-hidden="true" />
              <input
                type="text"
                id="last-name"
                value={form.complainant.lastName}
                onChange={handleLastNameChange}
                className="input-field pl-10 w-full"
                placeholder="Smith"
                required
              />
            </div>
          </div>
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gov-grey-900 mb-2">
            Email address <span className="text-gov-red">*</span>
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-5 w-5 text-gov-grey-400 pointer-events-none" aria-hidden="true" />
            <input
              type="email"
              id="email"
              value={form.complainant.email}
              onChange={handleEmailChange}
              className="input-field pl-10 w-full"
              placeholder="john.smith@example.com"
              required
            />
          </div>
          <p className="mt-1 text-xs text-gov-grey-500">
            We'll use this to contact you about your complaint
          </p>
        </div>

        {/* Phone (Optional) */}
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gov-grey-900 mb-2">
            Phone number (optional)
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-3 h-5 w-5 text-gov-grey-400 pointer-events-none" aria-hidden="true" />
            <input
              type="tel"
              id="phone"
              value={form.complainant.phone}
              onChange={handlePhoneChange}
              className="input-field pl-10 w-full"
              placeholder="02 1234 5678 or 0412 345 678"
            />
          </div>
          <p className="mt-1 text-xs text-gov-grey-500">
            Include your country code if calling from overseas
          </p>
        </div>

        {/* Privacy Notice */}
        <div className="rounded-md bg-gov-grey-50 border border-gov-grey-200 p-4 text-xs text-gov-grey-600 space-y-1">
          <p className="font-medium text-gov-grey-700">Privacy notice:</p>
          <p>
            Your contact details will be used only to communicate with you about your complaint. We will not share your personal information with third parties without your consent, except where required by law.
          </p>
        </div>
      </div>
    </div>
  );
}
