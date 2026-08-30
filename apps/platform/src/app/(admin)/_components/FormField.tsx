import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'

export const inputClass =
  'h-10 w-full rounded-input border border-border bg-bgPage px-3 text-bodySm text-ink outline-none transition-colors duration-hover ease-hover focus:border-primary focus:ring-2 focus:ring-primary/20'

export const primaryButtonClass =
  'inline-flex h-10 items-center gap-xs rounded-button bg-primary px-4 text-label font-semibold text-ink-inverse transition-colors duration-hover ease-hover hover:bg-primaryHover'

export const secondaryButtonClass =
  'inline-flex h-10 items-center gap-xs rounded-button border border-border bg-bgPage px-4 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:border-primary hover:text-primary'

function FieldShell({
  label,
  name,
  hint,
  children,
}: {
  label: ReactNode
  name: string
  hint?: string | undefined
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={`field-${name}`} className="text-label font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint ? <p className="text-bodySm text-ink-muted">{hint}</p> : null}
    </div>
  )
}

export interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode
  name: string
  hint?: string
}

export function FormField({ label, name, hint, id, ...rest }: FormFieldProps) {
  return (
    <FieldShell label={label} name={name} hint={hint}>
      <input id={id ?? `field-${name}`} name={name} className={inputClass} {...rest} />
    </FieldShell>
  )
}

export interface FormSelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: ReactNode
  name: string
  hint?: string
  options: readonly { value: string; label: string }[]
}

export function FormSelectField({ label, name, hint, id, options, ...rest }: FormSelectFieldProps) {
  return (
    <FieldShell label={label} name={name} hint={hint}>
      <select id={id ?? `field-${name}`} name={name} className={inputClass} {...rest}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  )
}

export interface FormTextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: ReactNode
  name: string
  hint?: string
}

export function FormTextareaField({
  label,
  name,
  hint,
  id,
  rows = 4,
  ...rest
}: FormTextareaFieldProps) {
  return (
    <FieldShell label={label} name={name} hint={hint}>
      <textarea
        id={id ?? `field-${name}`}
        name={name}
        rows={rows}
        className={`${inputClass} h-auto py-2`}
        {...rest}
      />
    </FieldShell>
  )
}
