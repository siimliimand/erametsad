'use client';

import {
  type InputHTMLAttributes,
  useId,
  type ReactNode,
} from 'react';
import { AlertCircle, Check } from 'lucide-react';

export interface FormCheckProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'label'> {
  label: ReactNode;
  name: string;
  error?: string;
  hint?: string;
}

export function FormCheck({
  label,
  name,
  error,
  hint,
  checked,
  onChange,
  className = '',
  id: externalId,
  ...rest
}: FormCheckProps) {
  const generatedId = useId();
  const id = externalId ?? generatedId;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-3">
        <div className="relative flex shrink-0 items-center">
          <input
            id={id}
            name={name}
            type="checkbox"
            checked={checked}
            onChange={onChange}
            aria-invalid={!!error}
            aria-describedby={
              [error ? errorId : null, hint ? hintId : null]
                .filter(Boolean)
                .join(' ') || undefined
            }
            className={`peer h-5 w-5 shrink-0 appearance-none rounded-[4px] border-2 bg-bgPage transition-colors duration-hover ease-hover motion-reduce:transition-none checked:border-primary checked:bg-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ${
              error
                ? 'border-danger checked:border-danger checked:bg-danger'
                : 'border-border'
            } ${className}`}
            {...rest}
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

      {hint && !error && (
        <p id={hintId} className="text-bodySm text-ink-muted">
          {hint}
        </p>
      )}
    </div>
  );
}