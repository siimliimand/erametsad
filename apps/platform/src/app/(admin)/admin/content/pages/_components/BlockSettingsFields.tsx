'use client'

import type { ChangeEvent, ReactNode } from 'react'

import {
  appendDraftItem,
  getDraftValue,
  removeDraftItem,
  updateDraftValue,
  type BlockDraft,
  type BlockFieldDescriptor,
} from './block-fields'
import { inputClass } from '../../../../_components/FormField'

/**
 * Renders the descriptor list produced from a block's zod schema into
 * controlled inputs bound to a draft config. Paths address nested values
 * ("primaryCta.label", "items.0.title") inside the JSON draft.
 */

interface BlockFieldContext {
  draft: BlockDraft
  errors: Record<string, string>
  onDraftChange: (draft: BlockDraft) => void
}

interface BlockSettingsFieldsProps extends BlockFieldContext {
  fields: BlockFieldDescriptor[]
}

interface BlockFieldProps extends BlockFieldContext {
  field: BlockFieldDescriptor
}

export function BlockSettingsFields({
  fields,
  draft,
  errors,
  onDraftChange,
}: BlockSettingsFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      {fields.map((field) => (
        <BlockField key={field.path} field={field} draft={draft} errors={errors} onDraftChange={onDraftChange} />
      ))}
    </div>
  )
}

function BlockField({ field, draft, errors, onDraftChange }: BlockFieldProps) {
  if (field.kind === 'array') {
    return (
      <ArrayField field={field} draft={draft} errors={errors} onDraftChange={onDraftChange} />
    )
  }
  if (field.kind === 'group') {
    return (
      <fieldset className="flex flex-col gap-3 rounded-[8px] border border-border p-3">
        <legend className="px-1 text-label font-semibold text-ink">
          {field.label}
          {field.required ? ' *' : ''}
        </legend>
        {field.fields.map((child) => (
          <BlockField key={child.path} field={child} draft={draft} errors={errors} onDraftChange={onDraftChange} />
        ))}
      </fieldset>
    )
  }
  return <LeafField field={field} draft={draft} errors={errors} onDraftChange={onDraftChange} />
}

function FieldShell({
  id,
  label,
  required,
  error,
  children,
}: {
  id: string
  label: string
  required: boolean
  error?: string | undefined
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-label font-semibold text-ink">
        {label}
        {required ? ' *' : ''}
      </label>
      {children}
      {error ? <p className="text-bodySm text-danger">{error}</p> : null}
    </div>
  )
}

function LeafField({ field, draft, errors, onDraftChange }: BlockFieldProps) {
  const id = `block-field-${field.path}`
  const error = errors[field.path]
  const value = getDraftValue(draft, field.path)
  const setValue = (next: unknown) => {
    onDraftChange(updateDraftValue(draft, field.path, next))
  }

  if (field.kind === 'select') {
    const rawValue = typeof value === 'string' || typeof value === 'number' ? value : ''
    return (
      <FieldShell id={id} label={field.label} required={field.required} error={error}>
        <select
          id={id}
          value={String(rawValue)}
          onChange={(event) => {
            const raw = event.target.value
            const numeric = Number(raw)
            setValue(raw !== '' && Number.isFinite(numeric) ? numeric : raw)
          }}
          className={inputClass}
        >
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FieldShell>
    )
  }

  if (field.kind === 'number') {
    return (
      <FieldShell id={id} label={field.label} required={field.required} error={error}>
        <input
          id={id}
          type="number"
          min={field.min}
          max={field.max}
          value={typeof value === 'number' ? String(value) : ''}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            const raw = event.target.value
            if (raw === '') {
              setValue('')
              return
            }
            const parsed = Number(raw)
            setValue(Number.isFinite(parsed) ? parsed : raw)
          }}
          className={inputClass}
        />
      </FieldShell>
    )
  }

  if (field.kind === 'string') {
    const common = {
      id,
      required: field.required,
      maxLength: field.maxLength,
      value: typeof value === 'string' ? value : '',
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setValue(event.target.value)
      },
      'aria-invalid': error ? true : undefined,
    }
    return (
      <FieldShell id={id} label={field.label} required={field.required} error={error}>
        {field.multiline ? (
          <textarea {...common} rows={4} className={`${inputClass} h-auto py-2`} />
        ) : (
          <input {...common} type="text" className={inputClass} />
        )}
      </FieldShell>
    )
  }

  return null
}

function ArrayField({
  field,
  draft,
  errors,
  onDraftChange,
}: BlockFieldProps & { field: Extract<BlockFieldDescriptor, { kind: 'array' }> }) {
  const list = getDraftValue(draft, field.path)
  const items = Array.isArray(list) ? list : []
  const canRemove = items.length > field.min
  const canAdd = field.max === undefined || items.length < field.max
  const error = errors[field.path]

  return (
    <fieldset className="flex flex-col gap-2 rounded-[8px] border border-border p-3">
      <legend className="px-1 text-label font-semibold text-ink">
        {field.label}
        {field.required ? ' *' : ''}
      </legend>
      {error ? <p className="text-bodySm text-danger">{error}</p> : null}
      {items.map((_, index) => (
        <div key={index} className="flex flex-col gap-3 rounded-[8px] bg-bgMist p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-label text-inkMuted">
              {`${field.itemLabel} ${String(index + 1)}`}
            </span>
            <button
              type="button"
              onClick={() => {
                onDraftChange(removeDraftItem(draft, field.path, index))
              }}
              disabled={!canRemove}
              className="rounded-[6px] border border-border px-1.5 py-0.5 text-[11px] font-medium leading-[14px] text-inkMuted transition-colors duration-hover ease-hover hover:border-danger hover:bg-dangerLight hover:text-danger disabled:pointer-events-none disabled:opacity-40"
            >
              Eemalda
            </button>
          </div>
          {field.fields.map((child) => (
            <BlockField key={child.path} field={child} draft={draft} errors={errors} onDraftChange={onDraftChange} />
          ))}
        </div>
      ))}
      {canAdd ? (
        <button
          type="button"
          onClick={() => {
            onDraftChange(appendDraftItem(draft, field.path, field.defaultItem))
          }}
          className="inline-flex w-fit items-center gap-1.5 rounded-pill border border-dashed border-border px-2.5 py-1 text-label font-medium text-inkMuted transition-colors duration-hover ease-hover hover:border-primary hover:bg-bgMist hover:text-primary"
        >
          {field.addLabel}
        </button>
      ) : null}
    </fieldset>
  )
}
