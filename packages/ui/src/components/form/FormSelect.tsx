'use client';

import { type SelectHTMLAttributes, useId, useState, type ReactNode } from 'react';
import { AlertCircle, ChevronDown } from 'lucide-react';

export interface FormSelectOption {
  value: string;
  label: string;
}

export interface FormSelectProps
  extends SelectHTMLAttributes<HTMLSelectElement> {
  label: ReactNode;
  name: string;
  options: FormSelectOption[];
  placeholder?: string;
  error?: string;
  hint?: string;
}

export function FormSelect({
  label,
  name,
  options,
  placeholder,
  error,
  hint,
  required,
  className = '',
  id: externalId,
  value,
  defaultValue,
  ...rest
}: FormSelectProps) {
  const generatedId = useId();
  const id = externalId ?? generatedId;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const [focused, setFocused] = useState(false);

  const hasSelection =
    value !== undefined
      ? value !== '' && value !== undefined
      : defaultValue !== undefined && defaultValue !== '';

  const float = focused || hasSelection;

  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <select
          id={id}
          name={name}
          required={required}
          aria-invalid={!!error}
          aria-describedby={
            [error ? errorId : null, hint ? hintId : null]
              .filter(Boolean)
              .join(' ') || undefined
          }
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          value={value}
          defaultValue={defaultValue}
          className={`peer h-14 w-full appearance-none rounded-input border bg-bgPage px-4 pt-5 text-body outline-none transition-all duration-hover ease-hover motion-reduce:transition-none ${
            error
              ? 'border-danger focus:border-danger focus:ring-2 focus:ring-danger/20'
              : 'border-border focus:border-primary focus:ring-2 focus:ring-primary/20'
          } ${className}`}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <ChevronDown
          className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted"
          aria-hidden="true"
        />

        <label
          htmlFor={id}
          className={`pointer-events-none absolute left-4 transition-all duration-hover ease-hover motion-reduce:transition-none ${
            float
              ? 'top-2 text-label font-semibold text-primary'
              : 'top-4 text-body text-ink-muted'
          } ${error ? 'text-danger' : ''}`}
        >
          {label}
          {required && (
            <span className="ml-0.5 text-danger" aria-hidden="true">
              *
            </span>
          )}
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