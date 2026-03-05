'use client';

import { useState } from 'react';
import { Save, SlidersHorizontal, Shield, Bell, Cpu } from 'lucide-react';
import type { PriorityWeights } from '../../../src/shared/types/complaint';

const DEFAULT_WEIGHTS: PriorityWeights = {
  riskScore: 0.30,
  systemicImpact: 0.25,
  monetaryHarm: 0.15,
  vulnerabilityIndicator: 0.20,
  resolutionProbability: 0.10,
};

export default function SettingsPage() {
  const [weights, setWeights] = useState<PriorityWeights>(DEFAULT_WEIGHTS);
  const [slaDefaults, setSlaDefaults] = useState({
    line1ResponseHours: 48,
    line2ResponseHours: 120,
    businessResponseDays: 14,
    escalationDays: 21,
  });
  const [autoSendEnabled, setAutoSendEnabled] = useState(false);
  const [aiProvider, setAiProvider] = useState('openai');

  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);

  function updateWeight(key: keyof PriorityWeights, value: number) {
    setWeights((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gov-grey-900">Settings</h1>
        <p className="mt-1 text-sm text-gov-grey-500">
          Configure triage weights, SLA defaults, and platform behaviour.
        </p>
      </div>

      <div className="space-y-6">
        {/* Priority Weights */}
        <div className="card">
          <div className="p-4 border-b border-gov-grey-100 flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-gov-blue-500" />
            <h2 className="font-medium text-gov-grey-900">Priority Score Weights</h2>
          </div>
          <div className="p-6">
            <p className="text-sm text-gov-grey-600 mb-6">
              Adjust how different factors contribute to the overall priority score.
              Weights should sum to 1.0.
              <span className={`ml-2 font-mono font-medium ${Math.abs(totalWeight - 1.0) > 0.01 ? 'text-gov-red' : 'text-gov-green'}`}>
                (Current total: {totalWeight.toFixed(2)})
              </span>
            </p>

            <div className="space-y-4">
              {([
                { key: 'riskScore', label: 'Risk Score', description: 'Weight of AI-assessed risk level' },
                { key: 'systemicImpact', label: 'Systemic Impact', description: 'Weight of systemic/industry-wide harm potential' },
                { key: 'monetaryHarm', label: 'Monetary Harm', description: 'Weight of financial impact on consumer' },
                { key: 'vulnerabilityIndicator', label: 'Vulnerability Indicator', description: 'Weight given to vulnerable consumer indicators' },
                { key: 'resolutionProbability', label: 'Resolution Probability (inverted)', description: 'Lower chance of self-resolution = higher priority' },
              ] as const).map(({ key, label, description }) => (
                <div key={key} className="flex items-center gap-4">
                  <div className="w-48">
                    <p className="text-sm font-medium text-gov-grey-900">{label}</p>
                    <p className="text-xs text-gov-grey-500">{description}</p>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="0.5"
                    step="0.05"
                    value={weights[key]}
                    onChange={(e) => updateWeight(key, parseFloat(e.target.value))}
                    className="flex-1"
                  />
                  <span className="w-12 text-right text-sm font-mono text-gov-grey-600">
                    {weights[key].toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SLA Defaults */}
        <div className="card">
          <div className="p-4 border-b border-gov-grey-100 flex items-center gap-2">
            <Bell className="h-5 w-5 text-gov-blue-500" />
            <h2 className="font-medium text-gov-grey-900">SLA Defaults</h2>
          </div>
          <div className="p-6 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gov-grey-700 mb-1">
                Line 1 Response (hours)
              </label>
              <input
                type="number"
                value={slaDefaults.line1ResponseHours}
                onChange={(e) => setSlaDefaults(prev => ({ ...prev, line1ResponseHours: Number(e.target.value) }))}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gov-grey-700 mb-1">
                Line 2 Response (hours)
              </label>
              <input
                type="number"
                value={slaDefaults.line2ResponseHours}
                onChange={(e) => setSlaDefaults(prev => ({ ...prev, line2ResponseHours: Number(e.target.value) }))}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gov-grey-700 mb-1">
                Business Response (days)
              </label>
              <input
                type="number"
                value={slaDefaults.businessResponseDays}
                onChange={(e) => setSlaDefaults(prev => ({ ...prev, businessResponseDays: Number(e.target.value) }))}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gov-grey-700 mb-1">
                Escalation Deadline (days)
              </label>
              <input
                type="number"
                value={slaDefaults.escalationDays}
                onChange={(e) => setSlaDefaults(prev => ({ ...prev, escalationDays: Number(e.target.value) }))}
                className="input-field"
              />
            </div>
          </div>
        </div>

        {/* AI & Safety */}
        <div className="card">
          <div className="p-4 border-b border-gov-grey-100 flex items-center gap-2">
            <Cpu className="h-5 w-5 text-gov-blue-500" />
            <h2 className="font-medium text-gov-grey-900">AI & Safety</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gov-grey-700 mb-1">AI Provider</label>
              <select
                value={aiProvider}
                onChange={(e) => setAiProvider(e.target.value)}
                className="input-field w-auto"
              >
                <option value="openai">OpenAI (GPT-4o)</option>
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="azure_openai">Azure OpenAI</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="autoSend"
                checked={autoSendEnabled}
                onChange={(e) => setAutoSendEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-gov-grey-300 text-gov-blue-500 focus:ring-gov-blue-500"
              />
              <div>
                <label htmlFor="autoSend" className="text-sm font-medium text-gov-grey-900">
                  Enable Auto-Send for Line 1 Responses
                </label>
                <p className="text-xs text-gov-grey-500">
                  When enabled, approved Line 1 AI-drafted responses will be sent automatically.
                  When disabled, all communications require manual approval.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button className="btn-primary gap-2">
            <Save className="h-4 w-4" />
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
