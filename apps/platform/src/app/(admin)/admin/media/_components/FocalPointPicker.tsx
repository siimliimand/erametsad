'use client'

import { useId, useState } from 'react'
import type { ChangeEvent, MouseEvent } from 'react'

/**
 * Click-to-set focal point picker (task 3.6): a small preview the editor
 * clicks to place the focal point, plus X/Y percent inputs and a clear
 * control. Coordinates are 0..1 fractions of the image — the same units the
 * lot editor stores (media.focal_x / focal_y) and the renditions pipeline
 * consumes for crops. Hidden inputs carry the values inside the surrounding
 * form, so a plain server action saves them.
 */

const inputClass =
  'h-9 rounded-input border border-border bg-bgPage px-2 text-bodySm text-ink'

interface Focal {
  x: number | null
  y: number | null
}

function focalFromPointer(event: MouseEvent<HTMLButtonElement>): { x: number; y: number } {
  const rect = event.currentTarget.getBoundingClientRect()
  const x = (event.clientX - rect.left) / rect.width
  const y = (event.clientY - rect.top) / rect.height
  return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) }
}

function percentToFraction(raw: string): number | null {
  if (raw.trim() === '') return null
  const percent = Number(raw)
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) return null
  return percent / 100
}

export interface FocalPointPickerProps {
  /** Preview image URL. */
  url: string
  /** Only for the accessible label; the preview is decorative. */
  filename: string
  /** Stored coordinates (0..1), or null when the image has no focal point. */
  focalX: number | null
  focalY: number | null
  /** Hidden input names inside the surrounding form. */
  names?: { x?: string; y?: string }
}

export function FocalPointPicker({
  url,
  filename,
  focalX,
  focalY,
  names = { x: 'focalX', y: 'focalY' },
}: FocalPointPickerProps) {
  const id = useId()
  const [focal, setFocal] = useState<Focal>({ x: focalX, y: focalY })
  const hasFocal = focal.x !== null && focal.y !== null

  const percentInputValue = (value: number | null): string =>
    value === null ? '' : String(Math.round(value * 100))

  const onPercentInput =
    (axis: keyof Focal) =>
    (event: ChangeEvent<HTMLInputElement>): void => {
      const value = percentToFraction(event.currentTarget.value)
      setFocal((current) => ({ ...current, [axis]: value }))
    }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-label font-semibold text-ink">Fookuspunkt</span>
      <button
        type="button"
        aria-label={`Vali pildi ${filename} fookuspunkt klõpsiga`}
        onClick={(event) => {
          // Keyboard activation reports (0,0); keyboard users set the
          // focal point via the X/Y inputs.
          if (event.detail === 0) return
          const point = focalFromPointer(event)
          setFocal({ x: point.x, y: point.y })
        }}
        className="relative h-20 w-32 overflow-hidden rounded-input border border-border"
      >
        <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
        {focal.x !== null && focal.y !== null ? (
          <span
            aria-hidden
            className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-pill border border-white bg-primary"
            style={{
              left: `${String(focal.x * 100)}%`,
              top: `${String(focal.y * 100)}%`,
            }}
          />
        ) : null}
      </button>
      <div className="flex items-center gap-xs">
        <label htmlFor={`${id}-x`} className="text-label text-inkMuted">
          X %
        </label>
        <input
          id={`${id}-x`}
          type="number"
          min={0}
          max={100}
          value={percentInputValue(focal.x)}
          onChange={onPercentInput('x')}
          className={`${inputClass} w-20`}
        />
        <label htmlFor={`${id}-y`} className="text-label text-inkMuted">
          Y %
        </label>
        <input
          id={`${id}-y`}
          type="number"
          min={0}
          max={100}
          value={percentInputValue(focal.y)}
          onChange={onPercentInput('y')}
          className={`${inputClass} w-20`}
        />
        {hasFocal || focal.x !== null || focal.y !== null ? (
          <button
            type="button"
            onClick={() => {
              setFocal({ x: null, y: null })
            }}
            className="whitespace-nowrap text-label text-inkMuted underline"
          >
            Eemalda
          </button>
        ) : null}
      </div>
      <input type="hidden" name={names.x ?? 'focalX'} value={focal.x ?? ''} />
      <input type="hidden" name={names.y ?? 'focalY'} value={focal.y ?? ''} />
      <p className="text-label text-inkMuted">Klõpsa pisipildil või sisesta X/Y protsentides.</p>
    </div>
  )
}
