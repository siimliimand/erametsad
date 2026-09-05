'use client'

import { useId } from 'react'

import { FieldHint, FieldLabel } from './wizard-ui'

/**
 * Checkbox multi-select inside a disclosure (docs 03 step 3 "Puuliigid (24)
 * [MA.KU.NU ▾] 3 valitud"). Native checkboxes keep it keyboard accessible.
 */
export function MultiSelectField({
  label,
  options,
  values,
  onChange,
  hint,
}: {
  label: string
  options: readonly { value: string; label: string }[]
  values: readonly string[]
  onChange: (values: string[]) => void
  hint?: string
}) {
  const id = useId()
  const selected = values.filter((value) => options.some((option) => option.value === value))

  function toggle(value: string): void {
    if (values.includes(value)) {
      onChange(values.filter((entry) => entry !== value))
    } else {
      onChange([...values, value])
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <FieldLabel htmlFor={`${id}-summary`}>{label}</FieldLabel>
      {hint ? <FieldHint>{hint}</FieldHint> : null}
      <details className="rounded-input border border-border bg-bgPage">
        <summary
          id={`${id}-summary`}
          className="flex h-10 cursor-pointer items-center justify-between px-3 text-bodySm text-ink"
        >
          <span>
            {selected.length === 0
              ? '— ei ole valitud —'
              : selected.length === 1
                ? selected[0]
                : `${String(selected.length)} valitud`}
          </span>
          <span aria-hidden className="text-inkMuted">
            ▾
          </span>
        </summary>
        <div className="grid grid-cols-2 gap-xs border-t border-border p-sm sm:grid-cols-3">
          {options.map((option) => (
            <label
              key={option.value}
              htmlFor={`${id}-${option.value}`}
              className="flex items-center gap-xs text-bodySm text-ink"
            >
              <input
                id={`${id}-${option.value}`}
                type="checkbox"
                checked={values.includes(option.value)}
                onChange={() => {
                  toggle(option.value)
                }}
                className="h-4 w-4 accent-primary"
              />
              {option.label}
            </label>
          ))}
        </div>
      </details>
    </div>
  )
}
