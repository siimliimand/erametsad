'use client'

import { PageBlocks } from '@erametsad/ui'
import type { PageBlockView } from '@erametsad/ui'
import { Monitor, Smartphone } from 'lucide-react'
import { useState } from 'react'
import type { ComponentType } from 'react'

import type { BuilderBlock } from './builder-types'

type PreviewDevice = 'desktop' | 'mobile'

type DeviceIcon = ComponentType<{ className?: string }>

const previewDevices: readonly { value: PreviewDevice; label: string; Icon: DeviceIcon }[] = [
  { value: 'desktop', label: 'Töölauavaade', Icon: Monitor },
  { value: 'mobile', label: 'Mobiilivaade', Icon: Smartphone },
]

const docWidthClass: Record<PreviewDevice, string> = {
  desktop: 'max-w-[640px]',
  mobile: 'max-w-[390px]',
}

/**
 * Widens the builder's typed union to the renderer's structural view type.
 * The renderer's guards skip configs that miss required fields, so unsaved
 * draft state is safe to feed in without a zod round-trip here.
 */
function toBlockViews(blocks: readonly BuilderBlock[]): PageBlockView[] {
  return blocks.map((block) => ({ id: block.id, type: block.type, config: block.config }))
}

const deviceToggleClass = 'inline-flex gap-1 rounded-[8px] border border-border bg-bgMist p-[3px]'

const deviceButtonBaseClass =
  'grid h-6 w-6 place-items-center rounded-[6px] transition-colors duration-hover ease-hover'

const deviceButtonActiveClass = 'bg-[var(--tint-primary-strong)] text-primary'

const deviceButtonIdleClass = 'text-inkMuted hover:bg-[var(--tint-primary)] hover:text-primary'

export interface BlockPreviewProps {
  /** Controlled: the page's live builder state, re-rendered on every change. */
  blocks: BuilderBlock[]
}

export function BlockPreview({ blocks }: BlockPreviewProps) {
  const [device, setDevice] = useState<PreviewDevice>('desktop')

  return (
    <section
      aria-label="Reaalajas eelvaade"
      className="flex flex-col rounded-card border border-border bg-bgPage"
    >
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <h3 className="flex-1 text-body font-semibold text-ink">Reaalajas eelvaade</h3>
        <div role="group" aria-label="Seadme vaade" className={deviceToggleClass}>
          {previewDevices.map(({ value, label, Icon }) => {
            const active = device === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setDevice(value)
                }}
                aria-pressed={active}
                aria-label={label}
                className={`${deviceButtonBaseClass} ${
                  active ? deviceButtonActiveClass : deviceButtonIdleClass
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-bgMist p-4">
        {blocks.length === 0 ? (
          <p className="rounded-[8px] border border-dashed border-border px-3 py-6 text-center text-bodySm text-inkMuted">
            Eelvaade ilmub siia, kui lehele on lisatud blokke.
          </p>
        ) : (
          <div
            className={`mx-auto w-full overflow-hidden rounded-card border border-border bg-bgPage shadow-card transition-[max-width] duration-200 ease-out ${
              docWidthClass[device]
            }`}
          >
            <PageBlocks blocks={toBlockViews(blocks)} />
          </div>
        )}
      </div>
    </section>
  )
}
