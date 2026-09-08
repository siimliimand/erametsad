import {
  TemplateCard,
  type TemplateCardData,
  type TemplateLifecycle,
} from './_components/TemplateCard'
import type { TemplateVersionEntry } from './_components/TemplateVersionHistory'
import { uploadContractTemplateAction } from '../../../_actions/contracts'
import { ErrorNotice } from '../../../_components/ErrorNotice'
import { PageHeader } from '../../../_components/PageHeader'
import { requireAdminRepositories } from '../../../_lib/admin'
import { can } from '../../../_lib/permissions'

import type { ContractTemplateType } from '@/lib/data/schema'

export const metadata = { title: 'Lepingu mallid' }

const smallButtonClass =
  'inline-flex h-8 items-center rounded-button border border-border bg-bgPage px-3 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:border-primary hover:text-primary'

const inputClass =
  'rounded-input border border-border bg-bgPage px-3 py-2 text-bodySm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none'

function readTokens(placeholders: unknown): { key: string }[] {
  if (!Array.isArray(placeholders)) return []
  return placeholders.flatMap((item) => {
    const key = (item as { key?: unknown } | null)?.key
    return typeof key === 'string' ? [{ key }] : []
  })
}

interface GroupedVersion extends TemplateVersionEntry {
  tokens: { key: string }[]
  sourceContent: string | null
  sourceFormat: 'html' | 'txt' | null
}

/** Draft save bumps the head version's minor ("3.0" -> "3.1"); uploads use "N.0". */
function suggestNextVersion(version: string): string {
  const dotIndex = version.lastIndexOf('.')
  if (dotIndex === -1) return `${version}.1`
  const minor = Number(version.slice(dotIndex + 1))
  const next = Number.isFinite(minor) ? minor + 1 : 1
  return `${version.slice(0, dotIndex)}.${String(next)}`
}

/**
 * Each contract_templates row is one version; a card groups the versions of
 * one named template (same name + type), newest upload first.
 */
function groupTemplateCards(
  templates: {
    id: string
    name: string
    type: ContractTemplateType
    version: string
    placeholders: unknown
    sourceContent: string | null
    sourceFormat: 'html' | 'txt' | null
    active: boolean
    createdAt: string
    updatedAt: string
  }[],
  rowLifecycle: Map<string, TemplateLifecycle>,
): TemplateCardData[] {
  const groups = new Map<
    string,
    { name: string; type: ContractTemplateType; versions: GroupedVersion[] }
  >()
  for (const template of templates) {
    const key = `${template.type}::${template.name}`
    const group = groups.get(key) ?? {
      name: template.name,
      type: template.type,
      versions: [],
    }
    group.versions.push({
      id: template.id,
      version: template.version,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
      active: template.active,
      tokens: readTokens(template.placeholders),
      sourceContent: template.sourceContent,
      sourceFormat: template.sourceFormat,
    })
    groups.set(key, group)
  }

  return [...groups.values()].flatMap((group) => {
    const versions = [...group.versions].sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
    )
    const head = versions[0]
    if (!head) return []
    const lifecycle: TemplateLifecycle = versions.some((entry) => entry.active)
      ? 'active'
      : (rowLifecycle.get(head.id) ?? 'draft')
    return [
      {
        id: head.id,
        name: group.name,
        type: group.type,
        lifecycle,
        tokens: head.tokens,
        updatedAt: head.updatedAt,
        versions,
        sourceContent: head.sourceContent,
        sourceFormat: head.sourceFormat,
        nextVersion: suggestNextVersion(head.version),
      },
    ]
  })
}

export default async function ContractTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ viga?: string; teade?: string }>
}) {
  const { viga, teade } = await searchParams
  const { session, repositories } = await requireAdminRepositories()
  if (!can(session.role, 'contracts:read')) {
    return (
      <div>
        <PageHeader title="Lepingu mallid" backHref="/admin/contracts" />
        <div className="rounded-input border border-danger bg-danger-light px-md py-sm text-bodySm text-danger">
          Malle saab hallata ainult administraator.
        </div>
      </div>
    )
  }

  const { docs: templates } = await repositories.find({
    collection: 'contract-templates',
    sort: '-updatedAt',
    pagination: false,
  })

  const templateIds = templates.map((template) => template.id)
  const lifecycleEntries =
    templateIds.length > 0
      ? (
          await repositories.find({
            collection: 'audit-entry',
            where: {
              and: [
                { action: { in: ['template.activate', 'template.deactivate'] } },
                { entityId: { in: templateIds } },
              ],
            },
            sort: '-createdAt',
            pagination: false,
            limit: 500,
          })
        ).docs
      : []
  const lastLifecycleEvent = new Map<string, string>()
  for (const entry of lifecycleEntries) {
    if (entry.entityId && !lastLifecycleEvent.has(entry.entityId)) {
      lastLifecycleEvent.set(entry.entityId, entry.action)
    }
  }

  const rowLifecycle = new Map<string, TemplateLifecycle>()
  for (const template of templates) {
    rowLifecycle.set(
      template.id,
      template.active
        ? 'active'
        : lastLifecycleEvent.get(template.id) === 'template.deactivate'
          ? 'archived'
          : 'draft',
    )
  }

  const cards = groupTemplateCards(templates, rowLifecycle)

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      {teade ? (
        <div className="mb-sm rounded-input border border-primaryLight bg-primaryLight px-md py-sm text-bodySm text-primaryDark">
          {teade}
        </div>
      ) : null}
      <PageHeader
        title="Lepingu mallid"
        description="Üks aktiivne mall tüübi kohta; aktiveerimine arhiivib eelmise. Uus versioon rakendub ainult uutele lepingutele."
        backHref="/admin/contracts"
      />

      <details className="mb-md rounded-card border border-border bg-bgPage p-md">
        <summary className="cursor-pointer text-label font-semibold text-primary">
          + Uus mall (laadi DOCX)
        </summary>
        <form action={uploadContractTemplateAction} className="mt-sm flex flex-col gap-sm">
          <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-label font-semibold text-ink">
              Nimi
              <input
                type="text"
                name="name"
                required
                minLength={2}
                placeholder="Raamleping"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-label font-semibold text-ink">
              Tüüp
              <select name="type" required defaultValue="auction" className={inputClass}>
                <option value="auction">Oksjonileping</option>
                <option value="framework">Raamleping</option>
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1 text-label font-semibold text-ink">
            Fail (DOCX või HTML)
            <input
              type="file"
              name="file"
              required
              accept=".docx,.html,.txt"
              className="text-bodySm text-ink"
            />
          </label>
          <p className="text-bodySm text-ink-muted">
            Kohatäited kontrollitakse kataloogi vastu: tundmatud kohatäited tõukavad faili
            tagasi, tüübile nõutud kohatäited peavad olema olemas.
          </p>
          <button type="submit" className={`${smallButtonClass} w-fit`}>
            Laadi mall üles
          </button>
        </form>
      </details>

      {cards.length === 0 ? (
        <div className="rounded-card border border-border bg-bgPage px-md py-md text-bodySm text-ink-muted">
          Malle ei ole.
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-md">
          {cards.map((card) => (
            <TemplateCard key={card.id} card={card} />
          ))}
        </div>
      )}
    </div>
  )
}
