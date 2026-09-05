'use client'

import { useId, useState } from 'react'

import { FieldError, FieldHint, FieldLabel } from './wizard-ui'
import { inputClass, secondaryButtonClass } from '../../../_components/FormField'

/**
 * Shared repeater for cadastres, registry numbers, compartments and forest
 * notifications (docs 03 "Repeater behaviour"): add/remove rows in order,
 * inline row validation, duplicate warnings and paste-multi (one value per
 * line, also comma/semicolon/space separated).
 */

const PASTE_SPLIT_PATTERN = /[\n,;\s]+/

export interface AuctionRepeaterProps {
  label: string
  addLabel: string
  pasteLabel: string
  values: readonly string[]
  onChange: (values: string[]) => void
  validate?: (value: string) => string | null
  errorMessage?: string | undefined
  hint?: string | undefined
  placeholder?: string | undefined
  required?: boolean
}

export function AuctionRepeater({
  label,
  addLabel,
  pasteLabel,
  values,
  onChange,
  validate,
  errorMessage,
  hint,
  placeholder,
  required = false,
}: AuctionRepeaterProps) {
  const id = useId()
  const [pasting, setPasting] = useState(false)
  const [pasteText, setPasteText] = useState('')

  const duplicates = new Set<string>()
  const seen = new Set<string>()
  for (const value of values) {
    const trimmed = value.trim()
    if (trimmed === '') continue
    if (seen.has(trimmed)) duplicates.add(trimmed)
    else seen.add(trimmed)
  }

  function updateRow(index: number, value: string): void {
    onChange(values.map((row, i) => (i === index ? value : row)))
  }

  function removeRow(index: number): void {
    onChange(values.filter((_, i) => i !== index))
  }

  function addRow(): void {
    onChange([...values, ''])
  }

  function applyPaste(): void {
    const tokens = pasteText
      .split(PASTE_SPLIT_PATTERN)
      .map((token) => token.trim())
      .filter((token) => token !== '')
    if (tokens.length > 0) {
      onChange([...values.filter((value) => value.trim() !== ''), ...tokens])
    }
    setPasteText('')
    setPasting(false)
  }

  return (
    <div className="flex flex-col gap-1">
      <FieldLabel htmlFor={`${id}-row-0`} required={required}>
        {label}
      </FieldLabel>
      {hint ? <FieldHint>{hint}</FieldHint> : null}
      <FieldError message={errorMessage} />
      <div className="flex flex-col gap-xs">
        {values.map((value, index) => {
          const trimmed = value.trim()
          const rowError = validate?.(trimmed) ?? null
          const duplicate = duplicates.has(trimmed)
          return (
            <div key={`${id}-row-${String(index)}`} className="flex flex-col gap-0.5">
              <div className="flex items-center gap-xs">
                <input
                  id={index === 0 ? `${id}-row-0` : undefined}
                  value={value}
                  placeholder={placeholder}
                  onChange={(event) => {
                    updateRow(index, event.target.value)
                  }}
                  className={`${inputClass} ${
                    rowError !== null && trimmed !== '' ? 'border-danger' : ''
                  }`}
                />
                {duplicate ? (
                  <span className="whitespace-nowrap text-bodySm text-info">duplikaat</span>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    removeRow(index)
                  }}
                  className="whitespace-nowrap rounded-button px-2 py-1.5 text-label text-inkMuted transition-colors duration-hover ease-hover hover:text-danger"
                  aria-label="Eemalda rida"
                >
                  Eemalda
                </button>
              </div>
              {rowError !== null && trimmed !== '' ? (
                <p className="text-bodySm font-medium text-danger">{rowError}</p>
              ) : null}
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-xs">
        <button type="button" onClick={addRow} className={secondaryButtonClass}>
          {addLabel}
        </button>
        <button
          type="button"
          onClick={() => {
            setPasting((current) => !current)
          }}
          className="text-label font-semibold text-primary underline-offset-2 hover:underline"
        >
          {pasting ? 'Sulge kleebimine' : pasteLabel}
        </button>
      </div>
      {pasting ? (
        <div className="flex flex-col gap-xs rounded-card border border-border bg-bgPage p-sm">
          <textarea
            value={pasteText}
            rows={4}
            placeholder="Üks väärtus rea kohta — lubatud on ka koma, semikoolon ja tühik"
            onChange={(event) => {
              setPasteText(event.target.value)
            }}
            className={`${inputClass} h-auto py-2 font-mono`}
          />
          <button type="button" onClick={applyPaste} className={secondaryButtonClass}>
            Lisa read
          </button>
        </div>
      ) : null}
    </div>
  )
}
