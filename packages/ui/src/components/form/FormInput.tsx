'use client';

import { AlertCircle } from 'lucide-react';
import {
  type InputHTMLAttributes,
  useId,
  useState,
  type ReactNode,
} from 'react';

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
  placeholder,
  value,
  defaultValue,
  ...rest
}: FormInputProps) {
  const generatedId = useId();
  const id = externalId ?? generatedId;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const [focused, setFocused] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue ?? '');

  const currentValue = value ?? internalValue;
  const hasValue = currentValue !== '';
  const hasPlaceholder = Boolean(placeholder && placeholder !== '');

  // Floating-label contract:
  // Floats to top-2 if focused, has a value, or has a placeholder.
  // This guarantees the label never collides with either a typed value or a placeholder.
  const float = focused || hasValue || hasPlaceholder;

  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <input
          id={id}
          name={name}
          type={type}
          required={required}
          value={value}
          defaultValue={defaultValue}
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
          onChange={(e) => {
            if (value === undefined) {
              setInternalValue(e.target.value);
            }
            rest.onChange?.(e);
          }}
          placeholder={hasPlaceholder ? placeholder : ''}
          className={`peer h-14 w-full rounded-input border bg-bgPage px-4 pt-5 text-body outline-none transition-all duration-hover ease-hover motion-reduce:transition-none disabled:bg-bgMist disabled:text-ink-muted placeholder:text-ink-muted/50 ${
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
              ? 'top-2 text-label font-semibold text-ink-muted'
              : 'top-4 text-body text-ink-muted'
          } ${focused ? '!text-primary' : ''} ${error ? '!text-danger' : ''} ${rest.disabled ? 'opacity-60' : ''}`}
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