'use client'

import type { ReactNode } from 'react'

import { inputClass } from '../../../_components/FormField'


export function FieldError({ message }: { readonly message: string | undefined }) {
  if (message === undefined || message === '') return null
  return (
    <p role="alert" className="text-bodySm font-medium text-danger">
      {message}
    </p>
  )
}

export function FieldHint({ children }: { children: ReactNode }) {
  return <p className="text-bodySm text-inkMuted">{children}</p>
}

export function FieldLabel({
  htmlFor,
  children,
  required,
}: {
  htmlFor: string
  children: ReactNode
  required?: boolean
}) {
  return (
    <label htmlFor={htmlFor} className="text-label font-semibold text-ink">
      {children}
      {required ? <span className="text-danger"> *</span> : null}
    </label>
  )
}

export function CheckboxToggle({
  id,
  label,
  checked,
  disabled = false,
  disabledTitle,
  onChange,
}: {
  id: string
  label: ReactNode
  checked: boolean
  disabled?: boolean
  disabledTitle?: string
  onChange: (checked: boolean) => void
}) {
  return (
    <label
      htmlFor={id}
      title={disabled ? disabledTitle : undefined}
      className="flex items-center gap-xs text-label font-semibold text-ink"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.checked)
        }}
        className="h-4 w-4 accent-primary"
      />
      {label}
    </label>
  )
}

export function WarningNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-input border border-info bg-infoLight px-sm py-xs text-bodySm text-info">
      {children}
    </p>
  )
}

export function TextInput({
  id,
  value,
  onChange,
  type = 'text',
  placeholder,
  disabled = false,
  invalid = false,
  onBlur,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'number' | 'date' | 'datetime-local'
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  onBlur?: () => void
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      step={type === 'number' ? 'any' : undefined}
      onBlur={onBlur}
      onChange={(event) => {
        onChange(event.target.value)
      }}
      className={`${inputClass} ${invalid ? 'border-danger focus:border-danger focus:ring-danger/20' : ''}`}
    />
  )
}
