'use client'

import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'

import { PageBlocksBuilder } from './PageBlocksBuilder'
import { VersionsDrawer } from './VersionsDrawer'
import type { BuilderBlock, BlockReorderDirection } from './builder-types'
import { applyBlocksJson, blocksToPayload, createBlock } from './editor-model'
import type { DrawerBlock, PageVersionOption } from './version-blocks'
import { savePageAction, savePageBlocksAction } from '../../../../_actions/content'
import {
  FormField,
  FormTextareaField,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../../../_components/FormField'
import { CheckboxField } from '../../_components/CheckboxField'

/**
 * Page editor for existing pages: the meta/publish form (mustand/ajasta/
 * avalda) backed by `savePageAction`, the block builder persisted through
 * `savePageBlocksAction`, the raw JSON escape hatch behind the "Kuva JSON"
 * disclosure and the versions drawer ("Ajavedu").
 *
 * The publish branch is carried by hidden inputs that the branch buttons
 * mutate via refs: a click handler's React state update is batched and can
 * lose the race against form serialization, a ref write cannot.
 */

export interface PageEditorProps {
  pageId: string
  title: string
  slug: string
  seoTitle: string
  seoDescription: string
  status: 'draft' | 'published'
  publishedAtInput: string
  redirectOffer: { from: string; to: string } | null
  initialBlocks: readonly BuilderBlock[]
  versions: readonly PageVersionOption[]
  savedBlocks: readonly DrawerBlock[]
}

type PublishBranch = 'draft' | 'publish' | 'schedule'

const publishLabels: Record<PublishBranch, { label: string; status: string; intent: string }> = {
  draft: { label: 'Salvesta mustandina', status: 'draft', intent: '' },
  publish: { label: 'Avalda', status: 'published', intent: '' },
  schedule: { label: 'Ajasta', status: 'published', intent: 'schedule' },
}

export function PageEditor({
  pageId,
  title,
  slug,
  seoTitle,
  seoDescription,
  status,
  publishedAtInput,
  redirectOffer,
  initialBlocks,
  versions,
  savedBlocks,
}: PageEditorProps) {
  const [blocks, setBlocks] = useState<BuilderBlock[]>([...initialBlocks])
  const [publishAt, setPublishAt] = useState(publishedAtInput)
  const [jsonDraft, setJsonDraft] = useState<string | null>(null)
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [versionsOpen, setVersionsOpen] = useState(false)

  const statusRef = useRef<HTMLInputElement>(null)
  const intentRef = useRef<HTMLInputElement>(null)

  const selectBranch = (branch: PublishBranch): void => {
    const choice = publishLabels[branch]
    if (statusRef.current) statusRef.current.value = choice.status
    if (intentRef.current) intentRef.current.value = choice.intent
  }

  const blocksPayload = blocksToPayload(blocks)

  const handleJsonChange = (event: ChangeEvent<HTMLTextAreaElement>): void => {
    setJsonDraft(event.target.value)
    setJsonError(null)
  }

  const applyJson = (): void => {
    const result = applyBlocksJson(jsonDraft ?? blocksPayload, blocks)
    if (!result.ok) {
      setJsonError(result.error)
      return
    }
    setBlocks(result.blocks)
    setJsonDraft(null)
    setJsonError(null)
  }

  const handleAdd = (type: BuilderBlock['type']): void => {
    setBlocks((current) => [...current, createBlock(type)])
  }

  const handleUpdate = (id: string, config: BuilderBlock['config']): void => {
    setBlocks((current) =>
      current.map((block) => (block.id === id ? ({ ...block, config } as BuilderBlock) : block)),
    )
  }

  const handleReorder = (id: string, direction: BlockReorderDirection): void => {
    setBlocks((current) => {
      const index = current.findIndex((block) => block.id === id)
      const target = direction === 'up' ? index - 1 : index + 1
      if (index < 0 || target < 0 || target >= current.length) return current
      const next = [...current]
      const [moved] = next.splice(index, 1)
      if (!moved) return current
      next.splice(target, 0, moved)
      return next
    })
  }

  const handleDelete = (id: string): void => {
    setBlocks((current) => current.filter((block) => block.id !== id))
  }

  return (
    <div className="flex flex-col gap-lg">
      <form
        action={savePageAction}
        className="max-w-container-sm space-y-sm rounded-card border border-border bg-bgPage p-md"
      >
        <input type="hidden" name="id" value={pageId} />
        <input ref={statusRef} type="hidden" name="status" value={status} />
        <input ref={intentRef} type="hidden" name="intent" value="" />
        <FormField label="Pealkiri" name="title" required defaultValue={title} />
        <FormField
          label="URL-nimi"
          name="slug"
          required
          hint="Näiteks: meist"
          defaultValue={slug}
        />
        <FormField label="SEO pealkiri" name="seoTitle" defaultValue={seoTitle} />
        <FormTextareaField
          label="SEO kirjeldus"
          name="seoDescription"
          rows={2}
          defaultValue={seoDescription}
        />
        <FormField
          label="Avaldamise aeg"
          name="publishAt"
          type="datetime-local"
          step="60"
          hint="Kellaaeg Europe/Tallinn. Planeeritud avaldamine tehakse automaatselt."
          value={publishAt}
          onChange={(event) => {
            setPublishAt(event.target.value)
          }}
        />
        {redirectOffer ? (
          <CheckboxField
            label="Loo suunamine vana aadressilt"
            name="createRedirect"
            hint={`URL-i muutusel luuakse suunamine aadressilt ${redirectOffer.from} aadressile uue URL-i.`}
            defaultChecked
          />
        ) : null}
        <div className="flex flex-wrap items-center gap-sm pt-xs">
          <button
            type="submit"
            onClick={() => {
              selectBranch('draft')
            }}
            className={secondaryButtonClass}
          >
            {publishLabels.draft.label}
          </button>
          <button
            type="submit"
            onClick={() => {
              selectBranch('schedule')
            }}
            disabled={publishAt.trim() === ''}
            title={publishAt.trim() === '' ? 'Vali esmalt tulevikus olev avaldamise aeg.' : undefined}
            className={secondaryButtonClass}
          >
            {publishLabels.schedule.label}
          </button>
          <button
            type="submit"
            onClick={() => {
              selectBranch('publish')
            }}
            className={primaryButtonClass}
          >
            {publishLabels.publish.label}
          </button>
        </div>
      </form>

      <form
        action={savePageBlocksAction}
        className="max-w-container-sm space-y-sm rounded-card border border-border bg-bgPage p-md"
      >
        <input type="hidden" name="pageId" value={pageId} />
        <input type="hidden" name="blocks" value={blocksPayload} />
        <PageBlocksBuilder
          blocks={blocks}
          onAdd={handleAdd}
          onUpdate={handleUpdate}
          onReorder={handleReorder}
          onDelete={handleDelete}
        />
        <div className="flex flex-wrap items-center gap-sm">
          <button type="submit" className={primaryButtonClass}>
            Salvesta blokid
          </button>
          <button
            type="button"
            onClick={() => {
              setVersionsOpen(true)
            }}
            className={secondaryButtonClass}
          >
            Ajavedu
          </button>
        </div>
        <details className="rounded-card border border-border p-sm">
          <summary className="cursor-pointer text-label font-semibold text-ink">Kuva JSON</summary>
          <div className="space-y-sm pt-sm">
            <textarea
              aria-label="Blokid JSON-ina"
              rows={12}
              className="h-auto w-full rounded-input border border-border bg-bgPage p-2 font-mono text-[11px] leading-4 text-ink outline-none transition-colors duration-hover ease-hover focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={jsonDraft ?? blocksPayload}
              onChange={handleJsonChange}
            />
            <div className="flex items-center gap-sm">
              <button type="button" onClick={applyJson} className={secondaryButtonClass}>
                Rakenda JSON
              </button>
              {jsonError ? <p className="text-bodySm font-semibold text-danger">{jsonError}</p> : null}
            </div>
          </div>
        </details>
      </form>

      <VersionsDrawer
        pageId={pageId}
        open={versionsOpen}
        onClose={() => {
          setVersionsOpen(false)
        }}
        versions={versions}
        currentBlocks={savedBlocks}
      />
    </div>
  )
}
