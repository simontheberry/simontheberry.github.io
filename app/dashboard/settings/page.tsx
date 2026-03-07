'use client';

import { useState } from 'react';
import { Save, SlidersHorizontal, Shield, Bell, Cpu, Palette, Sun, Moon } from 'lucide-react';
import type { PriorityWeights } from '../../../src/shared/types/complaint';
import type { ThemePresetId } from '../../../src/shared/types/theme';
import { THEME_PRESETS } from '../../../src/shared/constants/theme-defaults';
import { useTheme } from '../../../components/providers/ThemeProvider';
import { ColorPicker } from '../../../components/admin/ColorPicker';
import { ThemePreview } from '../../../components/admin/ThemePreview';

const DEFAULT_WEIGHTS: PriorityWeights = {
  riskScore: 0.30,
  systemicImpact: 0.25,
  monetaryHarm: 0.15,
  vulnerabilityIndicator: 0.20,
  resolutionProbability: 0.10,
};

const PRESET_OPTIONS: { id: ThemePresetId; name: string; description: string }[] = [
  { id: 'federal-blue', name: 'Federal Blue', description: 'Default government standard' },
  { id: 'accc-navy', name: 'ACCC Navy', description: 'Australian Competition & Consumer Commission' },
  { id: 'asic-teal', name: 'ASIC Teal', description: 'Securities & Investments Commission' },
  { id: 'acma-indigo', name: 'ACMA Indigo', description: 'Communications & Media Authority' },
  { id: 'neutral-slate', name: 'Neutral Slate', description: 'Minimal monochrome' },
];

export default function SettingsPage() {
  const { theme, presetId, setPreset, colorMode, setColorMode } = useTheme();
  const [weights, setWeights] = useState<PriorityWeights>(DEFAULT_WEIGHTS);
  const [slaDefaults, setSlaDefaults] = useState({
    line1ResponseHours: 48,
    line2ResponseHours: 120,
    businessResponseDays: 14,
    escalationDays: 21,
  });
  const [autoSendEnabled, setAutoSendEnabled] = useState(false);
  const [aiProvider, setAiProvider] = useState('openai');

  const [overrides, setOverrides] = useState({
    primaryColor: theme.colors.primary[500],
    secondaryColor: theme.colors.secondary[500],
    dangerColor: theme.colors.danger[500],
    successColor: theme.colors.success[500],
    warningColor: theme.colors.warning[500],
    headerBg: theme.headerBg,
    brandMark: theme.brandMark,
  });

  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);

  function updateWeight(key: keyof PriorityWeights, value: number) {
    setWeights((prev) => ({ ...prev, [key]: value }));
  }

  function handlePresetChange(id: ThemePresetId) {
    setPreset(id);
    const preset = THEME_PRESETS[id];
    setOverrides({
      primaryColor: preset.colors.primary[500],
      secondaryColor: preset.colors.secondary[500],
      dangerColor: preset.colors.danger[500],
      successColor: preset.colors.success[500],
      warningColor: preset.colors.warning[500],
      headerBg: preset.headerBg,
      brandMark: preset.brandMark,
    });
  }

  return (
    <div className="animate-page-enter">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gov-grey-900">Settings</h1>
        <p className="mt-1 text-sm text-gov-grey-500">
          Configure triage weights, SLA defaults, and platform behaviour.
        </p>
      </div>

      <div className="space-y-6">
        {/* Theme Customization */}
        <div className="card">
          <div className="p-4 border-b border-gov-grey-100 flex items-center gap-2">
            <Palette className="h-5 w-5 text-gov-blue-500" />
            <h2 className="font-medium text-gov-grey-900">Theme & Branding</h2>
          </div>
          <div className="p-6">
            {/* Color Mode Toggle */}
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gov-grey-100">
              <span className="text-sm font-medium text-gov-grey-700">Colour mode</span>
              <div className="flex rounded-lg bg-gov-grey-100 p-0.5">
                <button
                  type="button"
                  onClick={() => setColorMode('light')}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    colorMode === 'light'
                      ? 'bg-white text-gov-grey-900 shadow-sm'
                      : 'text-gov-grey-500 hover:text-gov-grey-700'
                  }`}
                >
                  <Sun className="h-3.5 w-3.5" /> Light
                </button>
                <button
                  type="button"
                  onClick={() => setColorMode('dark')}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    colorMode === 'dark'
                      ? 'bg-white text-gov-grey-900 shadow-sm'
                      : 'text-gov-grey-500 hover:text-gov-grey-700'
                  }`}
                >
                  <Moon className="h-3.5 w-3.5" /> Dark
                </button>
              </div>
            </div>

            {/* Preset Selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gov-grey-700 mb-3">Theme preset</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {PRESET_OPTIONS.map((preset) => {
                  const presetTheme = THEME_PRESETS[preset.id];
                  const isSelected = presetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handlePresetChange(preset.id)}
                      className={`relative rounded-lg border-2 p-3 text-left transition-all ${
                        isSelected
                          ? 'border-gov-blue-500 ring-1 ring-gov-blue-200 bg-gov-blue-50/30'
                          : 'border-gov-grey-200 hover:border-gov-grey-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex gap-1">
                          <span className="h-4 w-4 rounded-full border border-gov-grey-200" style={{ backgroundColor: presetTheme.headerBg }} />
                          <span className="h-4 w-4 rounded-full border border-gov-grey-200" style={{ backgroundColor: presetTheme.colors.primary[500] }} />
                          <span className="h-4 w-4 rounded-full border border-gov-grey-200" style={{ backgroundColor: presetTheme.brandMark }} />
                        </div>
                        {isSelected && (
                          <span className="ml-auto text-[10px] font-medium text-gov-blue-600 bg-gov-blue-100 rounded-full px-1.5 py-0.5">Active</span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gov-grey-900">{preset.name}</p>
                      <p className="text-xs text-gov-grey-500">{preset.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Color Overrides */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gov-grey-700 mb-3">Custom colour overrides</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <ColorPicker label="Primary" value={overrides.primaryColor} onChange={(c) => setOverrides(prev => ({ ...prev, primaryColor: c }))} description="Buttons, links, active states" />
                <ColorPicker label="Secondary" value={overrides.secondaryColor} onChange={(c) => setOverrides(prev => ({ ...prev, secondaryColor: c }))} description="Accent elements, badges" />
                <ColorPicker label="Header Background" value={overrides.headerBg} onChange={(c) => setOverrides(prev => ({ ...prev, headerBg: c }))} description="Top navigation bar" />
                <ColorPicker label="Brand Mark" value={overrides.brandMark} onChange={(c) => setOverrides(prev => ({ ...prev, brandMark: c }))} description="Logo/shield icon colour" />
                <ColorPicker label="Danger" value={overrides.dangerColor} onChange={(c) => setOverrides(prev => ({ ...prev, dangerColor: c }))} description="Errors, critical alerts" />
                <ColorPicker label="Success" value={overrides.successColor} onChange={(c) => setOverrides(prev => ({ ...prev, successColor: c }))} description="Completed, resolved states" />
              </div>
            </div>

            {/* Live Preview */}
            <div>
              <label className="block text-sm font-medium text-gov-grey-700 mb-3">Live preview</label>
              <ThemePreview
                primaryColor={overrides.primaryColor}
                secondaryColor={overrides.secondaryColor}
                dangerColor={overrides.dangerColor}
                successColor={overrides.successColor}
                warningColor={overrides.warningColor}
                headerBg={overrides.headerBg}
                brandMark={overrides.brandMark}
              />
            </div>
          </div>
        </div>

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
