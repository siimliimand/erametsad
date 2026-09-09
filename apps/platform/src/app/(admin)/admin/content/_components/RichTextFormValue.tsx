'use client'

import { useState } from 'react'

import { RichTextEditor } from '../../../_components/rich-text/RichTextEditor'
import { sanitizeHtml } from '../../../_components/rich-text/rich-text-sanitize'

/**
 * Rich text editor bound to a server-action form field. The editor output is
 * sanitized HTML; the hidden input mirrors it so the value reaches the form
 * action under `name` like any other field. Required-field enforcement stays
 * server-side (native constraint validation skips hidden inputs).
 */
export function RichTextFormValue({
  name,
  label,
  defaultValue,
  hint,
}: {
  name: string
  label: string
  defaultValue: string
  hint?: string
}) {
  const [value, setValue] = useState(() => sanitizeHtml(defaultValue))

  return (
    <div className="flex flex-col gap-1">
      <span className="text-label font-semibold text-ink">{label}</span>
      <RichTextEditor
        value={value}
        onChange={setValue}
        ariaLabel={label}
      />
      {hint ? <p className="text-bodySm text-inkMuted">{hint}</p> : null}
      <input type="hidden" name={name} value={value} />
    </div>
  )
}
