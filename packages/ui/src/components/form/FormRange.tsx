'use client';

import { useId, useState, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

export interface FormRangeProps {
  label: ReactNode;
  name: string;
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  formatDisplay?: (value: number) => string;
  error?: string;
  hint?: string;
}

export function FormRange({
  label,
  name,
  min,
  max,
  step = 1,
  value,
  onChange,
  formatDisplay,
  error,
  hint,
}: FormRangeProps) {
  const generatedId = useId();
  const id = generatedId;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const [localMin, setLocalMin] = useState(String(value[0]));
  const [localMax, setLocalMax] = useState(String(value[1]));

  const clamp = (n: number) => Math.max(min, Math.min(max, n));

  const commitMin = (raw: string) => {
    const parsed = clamp(Number(raw) || min);
    const clamped = Math.min(parsed, value[1]);
    onChange([clamped, value[1]]);
    setLocalMin(String(clamped));
  };

  const commitMax = (raw: string) => {
    const parsed = clamp(Number(raw) || max);
    const clamped = Math.max(parsed, value[0]);
    onChange([value[0], clamped]);
    setLocalMax(String(clamped));
  };

  const sliderMin = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Math.min(Number(e.target.value), value[1]);
    onChange([v, value[1]]);
    setLocalMin(String(v));
  };

  const sliderMax = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Math.max(Number(e.target.value), value[0]);
    onChange([value[0], v]);
    setLocalMax(String(v));
  };

  const range = max - min || 1;
  const pctMin = ((value[0] - min) / range) * 100;
  const pctMax = ((value[1] - min) / range) * 100;

  return (
    <div className="flex flex-col gap-1">
      <label className="text-body font-semibold text-primary">
        {label}
      </label>

      <div className="relative mt-2 h-6">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-border" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-primary"
          style={{ left: `${pctMin}%`, right: `${100 - pctMax}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value[0]}
          onChange={sliderMin}
          aria-label={`${name}-min`}
          className="pointer-events-none absolute inset-0 z-20 m-0 h-full w-full cursor-pointer appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-bgPage [&::-moz-range-thumb]:shadow-sm [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:relative [&::-webkit-slider-thumb]:z-30 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-bgPage [&::-webkit-slider-thumb]:shadow-sm"
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value[1]}
          onChange={sliderMax}
          aria-label={`${name}-max`}
          className="pointer-events-none absolute inset-0 z-10 m-0 h-full w-full cursor-pointer appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-bgPage [&::-moz-range-thumb]:shadow-sm [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:relative [&::-webkit-slider-thumb]:z-30 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-bgPage [&::-webkit-slider-thumb]:shadow-sm"
        />
      </div>

      <div className="mt-2 flex gap-3">
        <div className="relative flex-1">
          <input
            id={`${id}-min`}
            type="number"
            min={min}
            max={value[1]}
            step={step}
            value={localMin}
            onChange={(e) => setLocalMin(e.target.value)}
            onBlur={(e) => commitMin(e.target.value)}
            aria-label={`${name} minimum`}
            className={`h-10 w-full rounded-input border bg-bgPage px-3 text-body outline-none transition-all duration-hover ease-hover focus:ring-2 focus:ring-primary/20 ${
              error
                ? 'border-danger focus:border-danger focus:ring-danger/20'
                : 'border-border focus:border-primary'
            }`}
          />
        </div>
        <span className="self-center text-body text-ink-muted">–</span>
        <div className="relative flex-1">
          <input
            id={`${id}-max`}
            type="number"
            min={value[0]}
            max={max}
            step={step}
            value={localMax}
            onChange={(e) => setLocalMax(e.target.value)}
            onBlur={(e) => commitMax(e.target.value)}
            aria-label={`${name} maximum`}
            className={`h-10 w-full rounded-input border bg-bgPage px-3 text-body outline-none transition-all duration-hover ease-hover focus:ring-2 focus:ring-primary/20 ${
              error
                ? 'border-danger focus:border-danger focus:ring-danger/20'
                : 'border-border focus:border-primary'
            }`}
          />
        </div>

        {formatDisplay && (
          <div className="flex shrink-0 items-center gap-1 text-body text-ink-muted">
            <span>{formatDisplay(value[0])}</span>
            <span>–</span>
            <span>{formatDisplay(value[1])}</span>
          </div>
        )}
      </div>

      {error && (
        <div
          id={errorId}
          role="alert"
          className="flex items-center gap-1 text-bodySm text-danger"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {hint && !error && (
        <p id={hintId} className="text-bodySm text-ink-muted">
          {hint}
        </p>
      )}
    </div>
  );
}