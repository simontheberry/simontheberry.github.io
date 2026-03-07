'use client';

import { useState, useRef, useEffect } from 'react';

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
  description?: string;
}

const PRESET_SWATCHES = [
  '#313E8A', '#1B2A4A', '#003366', '#0d6e6e', '#4338ca',
  '#B78B2D', '#C23B22', '#2D7D46', '#d97706', '#3b82f6',
  '#0f172a', '#334155', '#64748b', '#94a3b8', '#ffffff',
];

export function ColorPicker({ label, value, onChange, description }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hexInput, setHexInput] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHexInput(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleHexSubmit() {
    const cleaned = hexInput.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(cleaned)) {
      onChange(cleaned);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-gov-grey-700 mb-1">{label}</label>
      {description && <p className="text-xs text-gov-grey-500 mb-2">{description}</p>}

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 rounded-md border border-gov-grey-300 bg-white px-3 py-2 text-sm shadow-sm hover:border-gov-grey-400 transition-colors w-full"
      >
        <span
          className="h-6 w-6 rounded border border-gov-grey-200 shrink-0"
          style={{ backgroundColor: value }}
        />
        <span className="font-mono text-gov-grey-700">{value}</span>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg bg-white p-3 shadow-xl ring-1 ring-gov-grey-200 animate-scale-in">
          <div className="mb-3">
            <input
              type="color"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="h-32 w-full cursor-pointer rounded border-0"
            />
          </div>

          <div className="mb-3 flex items-center gap-2">
            <input
              type="text"
              value={hexInput}
              onChange={(e) => setHexInput(e.target.value)}
              onBlur={handleHexSubmit}
              onKeyDown={(e) => e.key === 'Enter' && handleHexSubmit()}
              placeholder="#000000"
              className="input-field font-mono text-xs flex-1"
              maxLength={7}
            />
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            {PRESET_SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                onClick={() => onChange(swatch)}
                className={`h-7 w-full rounded border transition-all ${
                  value === swatch
                    ? 'border-gov-blue-500 ring-2 ring-gov-blue-200'
                    : 'border-gov-grey-200 hover:border-gov-grey-400'
                }`}
                style={{ backgroundColor: swatch }}
                title={swatch}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
