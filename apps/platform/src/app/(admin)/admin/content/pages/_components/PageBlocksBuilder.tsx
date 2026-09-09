'use client'

import {
  Activity,
  ChartColumn,
  ClipboardList,
  GripVertical,
  Heading2,
  HelpCircle,
  LayoutGrid,
  List,
  Megaphone,
  Quote,
  Type,
} from 'lucide-react'
import { useState } from 'react'
import type { ComponentType } from 'react'

import { BlockSettingsDrawer } from './BlockSettingsDrawer'
import { DeleteBlockModal } from './DeleteBlockModal'
import type { BuilderBlock, PageBlocksBuilderProps } from './builder-types'
import { secondaryButtonClass } from '../../../../_components/FormField'
import { ArrowDownIcon, ArrowUpIcon, PlusIcon } from '../../../../_components/icons'

import { blockRegistry, getBlockTypeLabel } from '@/lib/content/blocks'
import { pageBlockTypes, type PageBlockType } from '@/lib/data/schema'

type BlockIcon = ComponentType<{ className?: string }>

const blockTypeIcons: Record<PageBlockType, BlockIcon> = {
  hero: Heading2,
  text: Type,
  cards: LayoutGrid,
  accordion: List,
  form: ClipboardList,
  ticker: Activity,
  stats: ChartColumn,
  cta: Megaphone,
  testimonials: Quote,
  faq: HelpCircle,
}

const itemCountUnits: Partial<Record<PageBlockType, { one: string; many: string }>> = {
  cards: { one: 'kaart', many: 'kaarti' },
  accordion: { one: 'rida', many: 'rida' },
  stats: { one: 'näitarv', many: 'näitarvu' },
  faq: { one: 'küsimus', many: 'küsimust' },
}

function firstLine(text: string): string {
  return text.split('\n')[0]?.trim() ?? ''
}

function blockSummary(block: BuilderBlock): string {
  switch (block.type) {
    case 'hero':
      return block.config.heading
    case 'text':
      return block.config.heading?.trim()
        ? (block.config.heading ?? '')
        : firstLine(block.config.body)
    case 'form':
      return `${block.config.slug} · ${block.config.type}`
    case 'cta':
      return block.config.heading
    case 'testimonials': {
      return block.config.heading?.trim()
        ? block.config.heading
        : `${String(block.config.limit)} kliendilugu`
    }
    case 'ticker': {
      const unit = block.config.limit === 1 ? 'oksjon' : 'oksjonit'
      return block.config.heading?.trim()
        ? block.config.heading
        : `${String(block.config.limit)} ${unit}`
    }
    case 'cards':
    case 'accordion':
    case 'stats':
    case 'faq': {
      const count = block.config.items.length
      const units = itemCountUnits[block.type] ?? { one: 'rida', many: 'rida' }
      const unit = count === 1 ? units.one : units.many
      const heading =
        typeof block.config.heading === 'string' && block.config.heading.trim() !== ''
          ? block.config.heading
          : null
      const countLabel = `${String(count)} ${unit}`
      return heading ? `${heading} (${countLabel})` : countLabel
    }
  }
}

const miniButtonClass =
  'grid h-6 w-6 place-items-center rounded-[6px] text-inkMuted transition-colors duration-hover ease-hover hover:bg-bgMist hover:text-primary disabled:pointer-events-none disabled:opacity-40'

const miniTextClass =
  'rounded-[6px] border border-border px-1.5 py-0.5 text-[11px] font-medium leading-[14px] text-inkMuted transition-colors duration-hover ease-hover hover:border-primary hover:bg-bgMist hover:text-primary'

const miniTextDangerClass = `${miniTextClass} hover:border-danger hover:bg-dangerLight hover:text-danger`

export function PageBlocksBuilder({
  blocks,
  onAdd,
  onUpdate,
  onReorder,
  onDelete,
}: PageBlocksBuilderProps) {
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const editingIndex = blocks.findIndex((block) => block.id === editingId)
  const editing = editingIndex >= 0 ? blocks[editingIndex] : null
  const deleting = blocks.find((block) => block.id === deletingId) ?? null

  return (
    <section aria-label="Lehe blokid" className="rounded-card border border-border bg-bgPage">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <h3 className="flex-1 text-body font-semibold text-ink">Lehe blokid</h3>
        <span className="hidden font-mono text-label text-inkMuted sm:inline">▲▼ järjesta</span>
        <span className="font-mono text-label text-inkMuted">
          {`${String(blocks.length)} blokki`}
        </span>
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setAddMenuOpen((open) => !open)
            }}
            aria-expanded={addMenuOpen}
            aria-haspopup="true"
            className={`${secondaryButtonClass} h-9`}
          >
            <PlusIcon className="h-4 w-4" />
            Lisa blokk
          </button>
          {addMenuOpen ? (
            <>
              <div
                aria-hidden="true"
                className="fixed inset-0 z-10"
                onClick={() => {
                  setAddMenuOpen(false)
                }}
              />
              <div className="absolute right-0 top-full z-20 mt-1 w-80 rounded-card border border-border bg-bgPage p-1 shadow-modal">
                {pageBlockTypes.map((type) => {
                  const definition = blockRegistry[type]
                  const BlockIconComponent = blockTypeIcons[type]
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        onAdd(type)
                        setAddMenuOpen(false)
                      }}
                      className="flex w-full items-start gap-2.5 rounded-[8px] p-2 text-left transition-colors duration-hover ease-hover hover:bg-bgMist"
                    >
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[6px] bg-bgMist text-primary">
                        <BlockIconComponent className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-label font-semibold text-ink">
                          {definition.label}
                        </span>
                        <span className="block text-bodySm text-inkMuted">
                          {definition.meta.description}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </>
          ) : null}
        </div>
      </div>

      <ol className="flex list-none flex-col gap-2 p-3">
        {blocks.map((block, index) => {
          const BlockIconComponent = blockTypeIcons[block.type]
          return (
            <li
              key={block.id}
              className="flex items-center gap-2 rounded-[8px] border border-border bg-bgPage px-2.5 py-2"
            >
              <GripVertical aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-inkMuted" />
              <span className="w-6 shrink-0 text-right font-mono text-label text-inkMuted">
                {`${String(index + 1)}.`}
              </span>
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[6px] bg-bgMist text-primary">
                <BlockIconComponent className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-label font-semibold text-ink">
                  {getBlockTypeLabel(block.type)}
                </span>
                <span className="block truncate text-[11px] leading-[14px] text-inkMuted">
                  {blockSummary(block) || 'Ilma sisuta'}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => {
                    onReorder(block.id, 'up')
                  }}
                  disabled={index === 0}
                  aria-label="Teisalda üles"
                  className={miniButtonClass}
                >
                  <ArrowUpIcon className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onReorder(block.id, 'down')
                  }}
                  disabled={index === blocks.length - 1}
                  aria-label="Teisalda alla"
                  className={miniButtonClass}
                >
                  <ArrowDownIcon className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(block.id)
                  }}
                  className={`${miniTextClass} px-[7px]`}
                >
                  Muuda
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeletingId(block.id)
                  }}
                  className={`${miniTextDangerClass} px-[7px]`}
                >
                  Kustuta
                </button>
              </span>
            </li>
          )
        })}
        {blocks.length === 0 ? (
          <li className="rounded-[8px] border border-dashed border-border px-3 py-6 text-center text-bodySm text-inkMuted">
            Ühtegi blokki pole lisatud. Lisa esimene blokk menüüst „Lisa blokk“.
          </li>
        ) : null}
      </ol>

      {editing ? (
        <BlockSettingsDrawer
          key={editing.id}
          block={editing}
          ordinal={editingIndex + 1}
          onClose={() => {
            setEditingId(null)
          }}
          onSave={(config) => {
            onUpdate(editing.id, config)
            setEditingId(null)
          }}
        />
      ) : null}

      <DeleteBlockModal
        block={deleting}
        onClose={() => {
          setDeletingId(null)
        }}
        onDelete={() => {
          if (deleting) onDelete(deleting.id)
        }}
      />
    </section>
  )
}
