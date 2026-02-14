'use client';

import Link from 'next/link';
import { Shield, FileText, BarChart3, AlertTriangle } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gov-navy">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-gov-gold" />
            <div>
              <h1 className="text-lg font-semibold text-white">Regulatory Complaint Triage</h1>
              <p className="text-xs text-white/60">AI-Powered Consumer Protection</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Link href="/complaint-form" className="btn-secondary text-sm">
              Submit a Complaint
            </Link>
            <Link href="/dashboard/officer" className="btn-primary text-sm">
              Regulator Login
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-7xl px-6 py-20">
        <div className="text-center">
          <h2 className="text-4xl font-bold text-white tracking-tight sm:text-5xl">
            Intelligent Complaint Triage
          </h2>
          <p className="mt-6 text-lg leading-8 text-white/70 max-w-2xl mx-auto">
            Replace manual inbox processing with AI-powered triage, systemic detection,
            and structured workflow routing. Prioritise public harm over volume.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<FileText className="h-6 w-6" />}
            title="AI-Guided Intake"
            description="Structured complaint submission with AI that detects missing information and asks clarifying questions dynamically."
          />
          <FeatureCard
            icon={<AlertTriangle className="h-6 w-6" />}
            title="Intelligent Triage"
            description="Automated classification, risk scoring, and routing. Complaints prioritised by harm and complexity, not arrival order."
          />
          <FeatureCard
            icon={<BarChart3 className="h-6 w-6" />}
            title="Systemic Detection"
            description="Embedding-based clustering identifies systemic issues, repeat offenders, and emerging conduct risks across industries."
          />
        </div>

        {/* Quick Links */}
        <div className="mt-20 flex justify-center gap-6">
          <Link
            href="/complaint-form"
            className="rounded-lg bg-gov-gold px-8 py-3 text-sm font-semibold text-gov-navy hover:opacity-90 transition"
          >
            Submit a Complaint
          </Link>
          <Link
            href="/dashboard/officer"
            className="rounded-lg bg-white/10 px-8 py-3 text-sm font-semibold text-white ring-1 ring-white/20 hover:bg-white/20 transition"
          >
            View Dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl bg-white/5 p-8 ring-1 ring-white/10">
      <div className="mb-4 text-gov-gold">{icon}</div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-white/60 leading-relaxed">{description}</p>
    </div>
  );
}
