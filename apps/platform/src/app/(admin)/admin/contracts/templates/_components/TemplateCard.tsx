import type { TemplateVersionEntry } from './TemplateVersionHistory'
import { TemplateVersionHistory } from './TemplateVersionHistory'
import {
  activateContractTemplateAction,
  deactivateContractTemplateAction,
  testRenderTemplateAction,
} from '../../../../_actions/contracts'
import { StatusChip } from '../../../../_components/StatusChip'
import {
  CalendarClockIcon,
  FileTextIcon,
  ScrollTextIcon,
} from '../../../../_components/icons'
import { contractTemplateTypeLabels, formatDateTime } from '../../../../_lib/labels'
import { HtmlPreviewDrawer } from '../../_components/HtmlPreviewDrawer'
import { TemplateEditorModal } from '../../_components/TemplateEditorModal'

import type { ContractTemplateType } from '@/lib/data/schema'

export type TemplateLifecycle = 'draft' | 'active' | 'archived'

export interface TemplateCardData {
  id: string
  name: string
  type: ContractTemplateType
  lifecycle: TemplateLifecycle
  tokens: { key: string }[]
  updatedAt: string
  versions: TemplateVersionEntry[]
  /** Head version's stored editor source; NULL for DOCX-only templates. */
  sourceContent?: string | null
  sourceFormat?: 'html' | 'txt' | null
  /** Draft-save suggestion: head version with the minor bumped ("3.0" -> "3.1"). */
  nextVersion?: string
}

const MAX_VERSION_CHIPS = 3
const MAX_VISIBLE_TOKENS = 4

const smallButtonClass =
  'inline-flex h-8 items-center rounded-button border border-border bg-bgPage px-3 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:border-primary hover:text-primary'

const inputClass =
  'rounded-input border border-border bg-bgPage px-3 py-2 text-bodySm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none'

const typeIcons: Record<ContractTemplateType, typeof FileTextIcon> = {
  auction: FileTextIcon,
  framework: ScrollTextIcon,
}

function formatTokens(tokens: { key: string }[]): string {
  if (tokens.length === 0) return 'Kohatäited puuduvad'
  const visible = tokens.slice(0, MAX_VISIBLE_TOKENS).map((token) => `{{${token.key}}}`)
  const hidden = tokens.length - visible.length
  if (hidden > 0) visible.push(`+${String(hidden)}`)
  return visible.join(' ')
}

/**
 * One demo 08 "tpl-card": icon, name, recent version chips, unified status
 * pill, token line, meta, actions, collapsible version history. Actions
 * target the newest version (the card head).
 */
export function TemplateCard({ card }: { card: TemplateCardData }) {
  const Icon = typeIcons[card.type]
  const headVersion = card.versions[0]
  if (!headVersion) return null
  const versionChips = card.versions.slice(0, MAX_VERSION_CHIPS)

  return (
    <article className="flex flex-col gap-sm rounded-card border border-border bg-bgPage p-md shadow-card">
      <div className="flex items-start gap-2.5">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-input bg-bg-mist text-primary">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-bodySm font-semibold text-ink">{card.name}</h3>
          <span className="flex flex-wrap items-center gap-1.5">
            {versionChips.map((entry) => (
              <span
                key={entry.id}
                className="whitespace-nowrap rounded-pill border border-border bg-bg-mist px-2 py-0.5 font-mono text-label text-ink-muted"
              >
                {`v${entry.version}`}
              </span>
            ))}
            <StatusChip status={card.lifecycle} />
          </span>
        </div>
      </div>

      <p className="break-words font-mono text-label text-ink-muted">
        {formatTokens(card.tokens)}
      </p>

      <div className="flex flex-col gap-0.5 text-bodySm text-ink-muted">
        <span>{contractTemplateTypeLabels[card.type]}</span>
        <span className="flex items-center gap-1.5">
          <CalendarClockIcon className="h-3.5 w-3.5 flex-none" />
          {`Muudetud: ${formatDateTime(card.updatedAt)}`}
        </span>
      </div>

      <div className="mt-auto flex flex-wrap items-start gap-sm pt-xs">
        <TemplateEditorModal
          templateId={card.id}
          name={card.name}
          version={headVersion.version}
          initialSourceContent={card.sourceContent ?? null}
          initialSourceFormat={card.sourceFormat ?? null}
          nextVersion={card.nextVersion ?? ''}
          generatedCount={headVersion.generatedCount ?? 0}
        />
        <HtmlPreviewDrawer
          label="Testrender"
          drawerTitle={`Testrender — ${card.name} (v${headVersion.version})`}
          documentId={card.id}
          fetchDocument={testRenderTemplateAction}
        />
        {headVersion.active ? (
          <details>
            <summary className="cursor-pointer text-label font-semibold text-danger">
              Deaktiveeri
            </summary>
            <form
              action={deactivateContractTemplateAction}
              className="mt-xs flex w-64 flex-col gap-xs"
            >
              <input type="hidden" name="id" value={card.id} />
              <textarea
                name="reason"
                required
                minLength={5}
                rows={2}
                placeholder="Deaktiveerimise põhjus (kohustuslik)"
                className={inputClass}
              />
              <button
                type="submit"
                className="inline-flex h-8 items-center justify-center rounded-button border border-danger bg-bgPage px-3 text-label font-semibold text-danger transition-colors duration-hover ease-hover hover:bg-danger-light"
              >
                Kinnita deaktiveerimine
              </button>
            </form>
          </details>
        ) : (
          <form action={activateContractTemplateAction}>
            <input type="hidden" name="id" value={card.id} />
            <button type="submit" className={smallButtonClass}>
              Aktiveeri
            </button>
          </form>
        )}
      </div>

      <TemplateVersionHistory versions={card.versions} />
    </article>
  )
}
