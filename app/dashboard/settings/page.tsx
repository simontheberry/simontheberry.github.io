'use client';

import { useState, useEffect } from 'react';
import { Save, SlidersHorizontal, Bell, Cpu, Loader2, CheckCircle2, RotateCcw } from 'lucide-react';
import type { PriorityWeights } from '../../../src/shared/types/complaint';
import { useApi, useApiMutation } from '../../../components/hooks/useApi';

const DEFAULT_WEIGHTS: PriorityWeights = {
  riskScore: 0.30,
  systemicImpact: 0.25,
  monetaryHarm: 0.15,
  vulnerabilityIndicator: 0.20,
  resolutionProbability: 0.10,
};

const DEFAULT_SLA = {
  line1ResponseHours: 48,
  line2ResponseHours: 120,
  businessResponseDays: 14,
  escalationDays: 21,
};

interface SettingsData {
  priorityWeights: PriorityWeights;
  slaDefaults: typeof DEFAULT_SLA;
  autoSendEnabled: boolean;
  autoSendConfidenceThreshold: number;
  supervisorReviewThreshold: number;
  aiProvider: string;
  features: {
    emailIngestion: boolean;
    webhookIntake: boolean;
    publicPortal: boolean;
    autoResponse: boolean;
    systemicDetection: boolean;
  };
}

export default function SettingsPage() {
  const { data: loadedSettings, isLoading: isLoadingSettings, error: loadError } = useApi<SettingsData>('/api/v1/settings');

  const [weights, setWeights] = useState<PriorityWeights>(DEFAULT_WEIGHTS);
  const [slaDefaults, setSlaDefaults] = useState(DEFAULT_SLA);
  const [autoSendEnabled, setAutoSendEnabled] = useState(false);
  const [autoSendConfidenceThreshold, setAutoSendConfidenceThreshold] = useState(0.85);
  const [supervisorReviewThreshold, setSupervisorReviewThreshold] = useState(0.70);
  const [aiProvider, setAiProvider] = useState('openai');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const { mutate, isLoading: isSaving, error: saveError } = useApiMutation<unknown>();

  // Populate form from API response
  useEffect(() => {
    if (loadedSettings) {
      setWeights(loadedSettings.priorityWeights);
      setSlaDefaults(loadedSettings.slaDefaults);
      setAutoSendEnabled(loadedSettings.autoSendEnabled);
      setAutoSendConfidenceThreshold(loadedSettings.autoSendConfidenceThreshold);
      setSupervisorReviewThreshold(loadedSettings.supervisorReviewThreshold);
      setAiProvider(loadedSettings.aiProvider);
      setHasUnsavedChanges(false);
    }
  }, [loadedSettings]);

  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
  const weightsValid = Math.abs(totalWeight - 1.0) <= 0.01;
  const thresholdsValid = supervisorReviewThreshold < autoSendConfidenceThreshold;

  function updateWeight(key: keyof PriorityWeights, value: number) {
    setWeights((prev) => ({ ...prev, [key]: value }));
    setHasUnsavedChanges(true);
  }

  async function handleResetDefaults() {
    setSaveSuccess(false);
    const result = await mutate('/api/v1/settings/reset', 'POST', {});
    if (result !== null) {
      const data = result as unknown as SettingsData;
      setWeights(data.priorityWeights);
      setSlaDefaults(data.slaDefaults);
      setAutoSendEnabled(data.autoSendEnabled);
      setAutoSendConfidenceThreshold(data.autoSendConfidenceThreshold);
      setSupervisorReviewThreshold(data.supervisorReviewThreshold);
      setAiProvider(data.aiProvider);
      setHasUnsavedChanges(false);
    }
  }

  async function handleSave() {
    if (!weightsValid) return;
    setSaveSuccess(false);
    const result = await mutate('/api/v1/settings', 'PATCH', {
      priorityWeights: weights,
      slaDefaults,
      autoSendEnabled,
      autoSendConfidenceThreshold,
      supervisorReviewThreshold,
      aiProvider,
    });
    if (result !== null) {
      setSaveSuccess(true);
      setHasUnsavedChanges(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  }

  if (isLoadingSettings) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 bg-gov-grey-200 rounded" />
        <div className="card p-6 space-y-4">
          <div className="h-5 w-64 bg-gov-grey-200 rounded" />
          <div className="h-4 w-full bg-gov-grey-100 rounded" />
          <div className="h-4 w-3/4 bg-gov-grey-100 rounded" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-gov-red mb-2">Failed to load settings</p>
        <p className="text-xs text-gov-grey-500">{loadError}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gov-grey-900">Settings</h1>
          <p className="mt-1 text-sm text-gov-grey-500">
            Configure triage weights, SLA defaults, and platform behaviour.
          </p>
        </div>
        <button
          onClick={handleResetDefaults}
          className="btn-secondary gap-1.5 text-sm"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset to Defaults
        </button>
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
              Weights must sum to 1.0.
              <span className={`ml-2 font-mono font-medium ${weightsValid ? 'text-gov-green' : 'text-gov-red'}`}>
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

            {!weightsValid && (
              <div className="mt-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                Weights must sum to 1.0 before saving. Current total: {totalWeight.toFixed(2)}
              </div>
            )}
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
                min="1"
                max="720"
                value={slaDefaults.line1ResponseHours}
                onChange={(e) => {
                  setSlaDefaults(prev => ({ ...prev, line1ResponseHours: Number(e.target.value) }));
                  setHasUnsavedChanges(true);
                }}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gov-grey-700 mb-1">
                Line 2 Response (hours)
              </label>
              <input
                type="number"
                min="1"
                max="720"
                value={slaDefaults.line2ResponseHours}
                onChange={(e) => {
                  setSlaDefaults(prev => ({ ...prev, line2ResponseHours: Number(e.target.value) }));
                  setHasUnsavedChanges(true);
                }}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gov-grey-700 mb-1">
                Business Response (days)
              </label>
              <input
                type="number"
                min="1"
                max="90"
                value={slaDefaults.businessResponseDays}
                onChange={(e) => {
                  setSlaDefaults(prev => ({ ...prev, businessResponseDays: Number(e.target.value) }));
                  setHasUnsavedChanges(true);
                }}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gov-grey-700 mb-1">
                Escalation Deadline (days)
              </label>
              <input
                type="number"
                min="1"
                max="90"
                value={slaDefaults.escalationDays}
                onChange={(e) => {
                  setSlaDefaults(prev => ({ ...prev, escalationDays: Number(e.target.value) }));
                  setHasUnsavedChanges(true);
                }}
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
                onChange={(e) => {
                  setAiProvider(e.target.value);
                  setHasUnsavedChanges(true);
                }}
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
                onChange={(e) => {
                  setAutoSendEnabled(e.target.checked);
                  setHasUnsavedChanges(true);
                }}
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

            {/* Confidence Thresholds */}
            <div className="border-t border-gov-grey-100 pt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gov-grey-700 mb-1">
                  Auto-Send Confidence Threshold
                </label>
                <p className="text-xs text-gov-grey-500 mb-2">
                  AI-drafted responses will only be auto-sent when confidence exceeds this threshold.
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0.5"
                    max="1.0"
                    step="0.05"
                    value={autoSendConfidenceThreshold}
                    onChange={(e) => {
                      setAutoSendConfidenceThreshold(parseFloat(e.target.value));
                      setHasUnsavedChanges(true);
                    }}
                    className="flex-1"
                  />
                  <span className="w-12 text-right text-sm font-mono text-gov-grey-600">
                    {(autoSendConfidenceThreshold * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gov-grey-700 mb-1">
                  Supervisor Review Threshold
                </label>
                <p className="text-xs text-gov-grey-500 mb-2">
                  Responses below this confidence will be flagged for mandatory supervisor review.
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0.3"
                    max="1.0"
                    step="0.05"
                    value={supervisorReviewThreshold}
                    onChange={(e) => {
                      setSupervisorReviewThreshold(parseFloat(e.target.value));
                      setHasUnsavedChanges(true);
                    }}
                    className="flex-1"
                  />
                  <span className="w-12 text-right text-sm font-mono text-gov-grey-600">
                    {(supervisorReviewThreshold * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              {!thresholdsValid && (
                <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-700">
                  Supervisor review threshold should be lower than the auto-send threshold.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center justify-end gap-3">
          {saveError && (
            <span className="text-sm text-gov-red">{saveError}</span>
          )}
          {saveSuccess && (
            <span className="flex items-center gap-1 text-sm text-gov-green">
              <CheckCircle2 className="h-4 w-4" />
              Settings saved
            </span>
          )}
          {hasUnsavedChanges && !saveSuccess && (
            <span className="text-xs text-gov-grey-400">Unsaved changes</span>
          )}
          <button
            className="btn-primary gap-2"
            onClick={handleSave}
            disabled={isSaving || !weightsValid}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
