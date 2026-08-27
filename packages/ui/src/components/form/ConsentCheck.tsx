'use client';

import { useId, type ReactNode } from 'react';
import { AlertCircle, Check } from 'lucide-react';

export interface ConsentCheckProps {
  name: string;
  label: ReactNode;
  error?: string;
  onChange?: (checked: boolean) => void;
}

export function ConsentCheck({
  name,
  label,
  error,
  onChange,
}: ConsentCheckProps) {
  const generatedId = useId();
  const id = generatedId;
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-3">
        <div className="relative flex shrink-0 items-center">
          <input
            id={id}
            name={name}
            type="checkbox"
            required
            defaultChecked={false}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            onChange={(e) => onChange?.(e.target.checked)}
            className="peer h-5 w-5 shrink-0 appearance-none rounded-[4px] border-2 bg-bgPage transition-colors duration-hover ease-hover motion-reduce:transition-none checked:border-primary checked:bg-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <Check
            className="pointer-events-none absolute left-0 top-0 h-5 w-5 text-ink-inverse opacity-0 transition-opacity duration-hover ease-hover peer-checked:opacity-100 motion-reduce:transition-none"
            aria-hidden="true"
          />
        </div>

        <label
          htmlFor={id}
          className="cursor-pointer select-none pt-0.5 text-body"
        >
          {label}
        </label>
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
    </div>
  );
}