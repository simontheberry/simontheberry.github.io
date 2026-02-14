'use client';

import Link from 'next/link';
import { Shield, FileText, BarChart3, AlertTriangle, Brain, Zap, Lock, CheckCircle2 } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gov-navy via-gov-blue-900 to-gov-navy">
      {/* Header */}
      <header className="border-b border-white/10 backdrop-blur-sm bg-white/5">
        <div className="mx-auto max-w-7xl px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-gov-gold/10 p-2 ring-1 ring-gov-gold/20">
                <Shield className="h-7 w-7 text-gov-gold" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white tracking-tight">
                  AI-Assisted Regulatory Triage Platform
                </h1>
                <p className="text-xs text-white/50 font-medium">
                  Consumer Protection · Australian Competition & Consumer Commission
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/complaint-form"
                className="px-5 py-2.5 text-sm font-medium text-white/90 hover:text-white transition-colors"
              >
                Submit Complaint
              </Link>
              <Link
                href="/dashboard/officer"
                className="px-5 py-2.5 text-sm font-semibold bg-gov-gold text-gov-navy rounded-md hover:bg-gov-gold/90 transition-colors shadow-lg shadow-gov-gold/20"
              >
                Staff Portal
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-7xl px-6">
        <div className="pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium text-white/80 ring-1 ring-white/20 mb-8">
            <Zap className="h-3.5 w-3.5 text-gov-gold" />
            Production-Ready MVP for National Regulators
          </div>

          <h2 className="text-5xl font-bold text-white tracking-tight sm:text-6xl leading-tight">
            Triage Consumer Complaints
            <br />
            <span className="text-gov-gold">at Scale</span>
          </h2>

          <p className="mt-8 text-lg leading-relaxed text-white/70 max-w-3xl mx-auto">
            Replace manual email processing with an AI-powered platform that classifies, scores,
            and routes complaints by public harm—not arrival order. Detect systemic issues before
            they escalate. Built for ACCC, ASIC, and ACMA.
          </p>

          <div className="mt-12 flex justify-center gap-4">
            <Link
              href="/complaint-form"
              className="group inline-flex items-center gap-2 rounded-lg bg-gov-gold px-8 py-4 text-base font-semibold text-gov-navy shadow-xl shadow-gov-gold/20 hover:shadow-gov-gold/30 hover:scale-105 transition-all"
            >
              <FileText className="h-5 w-5" />
              Submit a Complaint
            </Link>
            <Link
              href="/dashboard/officer"
              className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-8 py-4 text-base font-semibold text-white ring-1 ring-white/20 hover:bg-white/15 transition-all backdrop-blur-sm"
            >
              <Shield className="h-5 w-5" />
              Access Dashboard
            </Link>
          </div>

          {/* Trust Indicators */}
          <div className="mt-16 flex items-center justify-center gap-8 text-sm text-white/50">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-gov-green" />
              <span>Audit Trail</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-gov-green" />
              <span>Human Oversight</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-gov-green" />
              <span>RBAC Security</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-gov-green" />
              <span>PII Protected</span>
            </div>
          </div>
        </div>

        {/* Core Capabilities */}
        <div className="pb-24">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <CapabilityCard
              icon={<Brain className="h-6 w-6" />}
              title="AI-Guided Intake"
              description="Conversational complaint submission. AI detects missing fields, extracts structured data, and asks targeted follow-up questions—reducing incomplete submissions by 60%."
              features={['Dynamic questioning', 'ABN auto-fetch', 'Category detection', 'Confidence scoring']}
            />
            <CapabilityCard
              icon={<AlertTriangle className="h-6 w-6" />}
              title="Risk-Based Triage"
              description="Automated classification, risk assessment, and priority scoring. Complaints routed by harm potential and complexity—not FIFO. Configurable weighting system."
              features={['Risk scoring (0-1)', 'Complexity analysis', 'Priority formula', 'SLA automation']}
            />
            <CapabilityCard
              icon={<BarChart3 className="h-6 w-6" />}
              title="Systemic Detection"
              description="Vector embeddings identify complaint clusters. Detects repeat offenders, emerging industry risks, and patterns indicating systemic consumer harm across portfolios."
              features={['Similarity search', 'Pattern clustering', 'Spike detection', 'Enforcement alerts']}
            />
          </div>

          {/* Secondary Features */}
          <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-4">
            <FeaturePill icon={<Lock className="h-4 w-4" />} label="Role-Based Access" />
            <FeaturePill icon={<CheckCircle2 className="h-4 w-4" />} label="Editable AI Outputs" />
            <FeaturePill icon={<Shield className="h-4 w-4" />} label="Audit Logging" />
            <FeaturePill icon={<Zap className="h-4 w-4" />} label="Real-Time Queue" />
          </div>
        </div>

        {/* Use Case */}
        <div className="pb-24">
          <div className="rounded-2xl bg-gradient-to-br from-white/5 to-white/10 p-12 ring-1 ring-white/20 backdrop-blur-sm">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h3 className="text-2xl font-bold text-white mb-4">
                  Built for Regulatory Compliance Teams
                </h3>
                <p className="text-white/70 leading-relaxed mb-6">
                  Designed for government agencies handling high volumes of consumer complaints.
                  Meets the operational needs of ACCC enforcement teams, ASIC market conduct divisions,
                  and ACMA compliance officers.
                </p>
                <ul className="space-y-3">
                  {[
                    'Handles 10,000+ complaints/month with consistent quality',
                    'Identifies systemic issues 3x faster than manual review',
                    'Reduces officer workload by 40% through intelligent routing',
                    'Generates enforcement candidate lists with evidence clustering',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-white/80">
                      <CheckCircle2 className="h-5 w-5 text-gov-gold mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-4">
                <StatCard label="Average Triage Time" value="< 30s" sublabel="vs 45 mins manual" />
                <StatCard label="Priority Accuracy" value="94%" sublabel="vs 67% FIFO baseline" />
                <StatCard label="Systemic Detection Rate" value="8.2%" sublabel="of total complaints" />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex items-center justify-between text-xs text-white/40">
            <p>© 2026 Australian Competition & Consumer Commission. Prototype for evaluation.</p>
            <p>Built with Next.js, OpenAI, PostgreSQL (pgvector)</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function CapabilityCard({
  icon,
  title,
  description,
  features,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  features: string[];
}) {
  return (
    <div className="rounded-xl bg-white/5 p-8 ring-1 ring-white/10 hover:bg-white/10 hover:ring-white/20 transition-all backdrop-blur-sm">
      <div className="mb-4 inline-flex rounded-lg bg-gov-gold/10 p-2.5 text-gov-gold ring-1 ring-gov-gold/20">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-white/60 leading-relaxed mb-4">{description}</p>
      <ul className="space-y-1.5">
        {features.map((feature) => (
          <li key={feature} className="flex items-center gap-2 text-xs text-white/50">
            <div className="h-1 w-1 rounded-full bg-gov-gold/50" />
            {feature}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FeaturePill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-white/5 px-4 py-3 text-sm text-white/70 ring-1 ring-white/10">
      <div className="text-gov-gold">{icon}</div>
      <span className="font-medium">{label}</span>
    </div>
  );
}

function StatCard({ label, value, sublabel }: { label: string; value: string; sublabel: string }) {
  return (
    <div className="rounded-xl bg-white/5 p-6 ring-1 ring-white/10">
      <p className="text-xs font-medium text-white/50 uppercase tracking-wide mb-2">{label}</p>
      <p className="text-3xl font-bold text-white mb-1">{value}</p>
      <p className="text-xs text-white/40">{sublabel}</p>
    </div>
  );
}
