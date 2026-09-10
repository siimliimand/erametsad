'use client'

import { useId, type InputHTMLAttributes } from 'react'

interface AuthFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'> {
  label: string
  name: string
  error?: string | null
}

// Demo 05 auth field: visible label above the input (the shared FormInput's
// floating label cannot render the demo's numeric placeholder).
export function AuthField({
  label,
  name,
  error,
  disabled = false,
  ...rest
}: AuthFieldProps) {
  const inputId = useId()
  const errorId = `${inputId}-error`

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="font-body text-bodySm font-semibold text-ink">
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`h-12 w-full rounded-button border bg-bgPage px-3.5 font-body text-body text-ink placeholder:text-inkMuted outline-none transition-colors duration-hover ease-hover motion-reduce:transition-none ${
          error
            ? 'border-danger focus:border-danger focus:ring-2 focus:ring-danger/20'
            : 'border-border focus:border-primary focus:ring-2 focus:ring-primary/20'
        }`}
        {...rest}
      />
      {error && (
        <p id={errorId} role="alert" className="font-body text-bodySm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
