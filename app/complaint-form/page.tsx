'use client';

import { Shield } from 'lucide-react';
import { IntakeWizard } from '../../components/intake/IntakeWizard';

export default function ComplaintFormPage() {
  return (
    <div className="min-h-screen bg-gov-grey-50">
      <header className="bg-gov-navy" role="banner">
        <div className="mx-auto max-w-3xl px-6 py-4 flex items-center gap-3">
          <Shield className="h-7 w-7 text-gov-gold" aria-hidden="true" />
          <div>
            <h1 className="text-base font-semibold text-white">Submit a Complaint</h1>
            <p className="text-xs text-white/60">Consumer Protection Regulator</p>
          </div>
        </div>
      </header>
      <main id="main-content" className="mx-auto max-w-3xl px-6 py-8">
        <IntakeWizard />
      </main>
    </div>
  );
}
