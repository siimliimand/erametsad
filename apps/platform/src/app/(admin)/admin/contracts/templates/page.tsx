import {
  activateContractTemplateAction,
  deactivateContractTemplateAction,
  testRenderTemplateAction,
  uploadContractTemplateAction,
} from '../../../_actions/contracts'
import { DataTable } from '../../../_components/DataTable'
import { ErrorNotice } from '../../../_components/ErrorNotice'
import { PageHeader } from '../../../_components/PageHeader'
import { requireAdminRepositories } from '../../../_lib/admin'
import {
  contractTemplateTypeLabels,
  formatDateTime,
} from '../../../_lib/labels'
import { can } from '../../../_lib/permissions'
import { HtmlPreviewDrawer } from '../_components/HtmlPreviewDrawer'

import type { ContractTemplateType } from '@/lib/data/schema'

export const metadata = { title: 'Lepingu mallid' }

interface TemplateRow {
  id: string
  name: string
  type: string
  version: string
  active: boolean
  lifecycle: 'draft' | 'active' | 'archived'
  tokens: { key: string }[]
  updatedAt: string
}

const smallButtonClass =
  'inline-flex h-8 items-center rounded-button border border-border bg-bgPage px-3 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:border-primary hover:text-primary'

const inputClass =
  'rounded-input border border-border bg-bgPage px-3 py-2 text-bodySm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none'

const lifecycleLabels: Record<TemplateRow['lifecycle'], string> = {
  draft: 'Mustand',
  active: 'Aktiivne',
  archived: 'Arhiivis',
}

const lifecycleClasses: Record<TemplateRow['lifecycle'], string> = {
  draft: 'bg-bg-mist text-ink-muted',
  active: 'bg-primary-light text-primaryDark',
  archived: 'bg-bg-mist text-ink-muted',
}

function readTokens(placeholders: unknown): { key: string }[] {
  if (!Array.isArray(placeholders)) return []
  return placeholders.flatMap((item) => {
    const key = (item as { key?: unknown } | null)?.key
    return typeof key === 'string' ? [{ key }] : []
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

  const rows: TemplateRow[] = templates.map((template) => {
    const lastEvent = lastLifecycleEvent.get(template.id)
    const lifecycle: TemplateRow['lifecycle'] = template.active
      ? 'active'
      : lastEvent === 'template.deactivate'
        ? 'archived'
        : 'draft'
    return {
      id: template.id,
      name: template.name,
      type: template.type,
      version: template.version,
      active: template.active,
      lifecycle,
      tokens: readTokens(template.placeholders),
      updatedAt: template.updatedAt,
    }
  })

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

      <DataTable
        columns={[
          { key: 'name', label: 'Nimi' },
          {
            key: 'type',
            label: 'Tüüp',
            render: (row) => contractTemplateTypeLabels[row.type as ContractTemplateType],
          },
          { key: 'version', label: 'Versioon' },
          {
            key: 'lifecycle',
            label: 'Olek',
            render: (row) => (
              <span
                className={`inline-flex items-center rounded-pill px-2 py-0.5 text-label font-semibold ${lifecycleClasses[row.lifecycle]}`}
              >
                {lifecycleLabels[row.lifecycle]}
              </span>
            ),
          },
          {
            key: 'tokens',
            label: 'Kohatäited',
            render: (row) =>
              row.tokens.length === 0 ? (
                '—'
              ) : (
                <details>
                  <summary className="cursor-pointer text-label text-ink-muted">
                    {String(row.tokens.length)} kohatäidet
                  </summary>
                  <ul className="mt-xs flex max-w-64 flex-col gap-0.5">
                    {row.tokens.map((token) => (
                      <li key={token.key} className="font-mono text-label text-ink-muted">
                        {`{{${token.key}}}`}
                      </li>
                    ))}
                  </ul>
                </details>
              ),
          },
          {
            key: 'updatedAt',
            label: 'Muudetud',
            render: (row) => formatDateTime(row.updatedAt),
          },
          {
            key: 'actions',
            label: 'Tegevused',
            render: (row) => (
              <div className="flex flex-col items-start gap-xs">
                <HtmlPreviewDrawer
                  label="Testrender"
                  drawerTitle={`Testrender — ${row.name} (v${row.version})`}
                  documentId={row.id}
                  fetchDocument={testRenderTemplateAction}
                />
                {row.active ? (
                  <details>
                    <summary className="cursor-pointer text-label font-semibold text-danger">
                      Deaktiveeri
                    </summary>
                    <form
                      action={deactivateContractTemplateAction}
                      className="mt-xs flex w-64 flex-col gap-xs"
                    >
                      <input type="hidden" name="id" value={row.id} />
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
                    <input type="hidden" name="id" value={row.id} />
                    <button type="submit" className={smallButtonClass}>
                      Aktiveeri
                    </button>
                  </form>
                )}
              </div>
            ),
          },
        ]}
        rows={rows}
        emptyLabel="Malle ei ole."
      />
    </div>
  )
}
