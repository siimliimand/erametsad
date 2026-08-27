'use client';

import {
  type InputHTMLAttributes,
  useId,
  useState,
  type ReactNode,
} from 'react';
import { AlertCircle } from 'lucide-react';

export interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
  name: string;
  error?: string;
  hint?: string;
}

export function FormInput({
  label,
  name,
  type = 'text',
  error,
  hint,
  required,
  className = '',
  id: externalId,
  ...rest
}: FormInputProps) {
  const generatedId = useId();
  const id = externalId ?? generatedId;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const [focused, setFocused] = useState(false);
  const [hasValue, setHasValue] = useState(false);
  const float = focused || hasValue;

  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <input
          id={id}
          name={name}
          type={type}
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
            setHasValue(!!e.target.value);
            rest.onBlur?.(e);
          }}
          onChange={(e) => {
            setHasValue(!!e.target.value);
            rest.onChange?.(e);
          }}
          placeholder={float ? '' : typeof label === 'string' ? label : ''}
          className={`peer h-14 w-full rounded-input border bg-bgPage px-4 pt-5 text-body outline-none transition-all duration-hover ease-hover motion-reduce:transition-none ${
            error
              ? 'border-danger focus:border-danger focus:ring-2 focus:ring-danger/20'
              : 'border-border focus:border-primary focus:ring-2 focus:ring-primary/20'
          } ${className}`}
          {...rest}
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