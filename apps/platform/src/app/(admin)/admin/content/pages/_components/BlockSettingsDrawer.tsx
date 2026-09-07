'use client'

import { useState } from 'react'

import { BlockSettingsFields } from './BlockSettingsFields'
import { buildBlockFields, cloneDraft, type BlockDraft } from './block-fields'
import type { BuilderBlock } from './builder-types'
import { primaryButtonClass, secondaryButtonClass } from '../../../../_components/FormField'
import { Drawer } from '../../../../_components/ui/Drawer'

import {
  getBlockTypeLabel,
  safeParseBlockConfig,
  type BlockConfig,
} from '@/lib/content/blocks'

/**
 * Per-block settings drawer. Edits a local JSON draft; "Salvesta" parses the
 * draft through the block's registry zod schema, so only validated configs
 * leave the drawer (field-level errors stay inline otherwise).
 *
 * The parent mounts this only while a block is being edited (keyed by the
 * block id), so the draft always starts from the block's saved config.
 */
export interface BlockSettingsDrawerProps {
  block: BuilderBlock
  ordinal: number
  onClose: () => void
  onSave: (config: BlockConfig) => void
}

export function BlockSettingsDrawer({
  block,
  ordinal,
  onClose,
  onSave,
}: BlockSettingsDrawerProps) {
  const [draft, setDraft] = useState<BlockDraft>(() => cloneDraft(block.config))
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSave = () => {
    const result = safeParseBlockConfig(block.type, draft)
    if (result.success) {
      onSave(result.data)
      return
    }
    const fieldErrors: Record<string, string> = {}
    for (const issue of result.error.issues) {
      const path = issue.path || '_'
      fieldErrors[path] ??= issue.message
    }
    setErrors(fieldErrors)
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={getBlockTypeLabel(block.type)}
      subtitle={`Blokk ${String(ordinal)}`}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Tühista
          </button>
          <button type="button" onClick={handleSave} className={primaryButtonClass}>
            Salvesta
          </button>
        </>
      }
    >
      {Object.keys(errors).length > 0 ? (
        <p className="mb-4 flex gap-2 rounded-[8px] bg-dangerLight p-2.5 text-bodySm font-medium text-danger">
          Salvestamine ebaõnnestus. Kontrolli märgitud välju.
        </p>
      ) : null}
      <BlockSettingsFields
        fields={buildBlockFields(block.type)}
        draft={draft}
        errors={errors}
        onDraftChange={(next) => {
          setDraft(next)
          setErrors({})
        }}
      />
    </Drawer>
  )
}
