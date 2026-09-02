import { Card } from '@erametsad/ui'
import type { Metadata } from 'next'
import Link from 'next/link'

import { ContractPill } from './_components/contract-pill'

import { requirePortalSession } from '@/app/(portal)/_lib/session'
import { getRepositories } from '@/lib/data/runtime'
import type { Contract, ContractTemplate } from '@/lib/data/schema'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Lepingud',
}

interface ContractRowView {
  id: string
  typeLabel: string
  type: 'framework' | 'auction'
  lotId: string | null
  auctionTitle: string | null
  version: string | null
  status: Contract['status']
  signedAt: string | null
  href: string
}

function typeLabelOf(type: string): string {
  return type === 'framework' ? 'Raamleping' : 'Oksjonileping'
}

function fmtDate(value: string | null): string | null {
  if (value === null) return null
  const time = Date.parse(value)
  if (Number.isNaN(time)) return null
  return new Date(time).toLocaleDateString('et-EE', { dateStyle: 'long' })
}

export default async function LepingudPage() {
  const { session } = await requirePortalSession('/lepingud')

  // Contract rows carry no owner on the mock service except signedBy, so the
  // list scopes to the caller's signed contracts; in-progress flows resume
  // from their signing page. Auction and template lookups run as system
  // context because the guard's published-only filter would hide ended lots.
  const systemRepos = await getRepositories()
  const contractsResult = await systemRepos.find({
    collection: 'contracts',
    where: { signedBy: { equals: session.userId } },
    sort: '-createdAt',
  })
  const contracts = contractsResult.docs

  const templateIds = [...new Set(contracts.map((contract) => contract.templateId))]
  const templates =
    templateIds.length > 0
      ? await systemRepos.find({
          collection: 'contract-templates',
          where: { id: { in: templateIds } },
          pagination: false,
        })
      : { docs: [] as ContractTemplate[] }
  const templateById = new Map(templates.docs.map((template) => [template.id, template]))

  const lotIds = [...new Set(contracts.map((contract) => contract.lotId))]
  const auctions =
    lotIds.length > 0
      ? await systemRepos.find({
          collection: 'auctions',
          where: { id: { in: lotIds } },
          pagination: false,
        })
      : { docs: [] as { id: string; title: string }[] }
  const auctionTitleById = new Map(auctions.docs.map((auction) => [auction.id, auction.title]))

  const rows: ContractRowView[] = contracts.map((contract) => {
    const template = templateById.get(contract.templateId)
    const type = template?.type === 'framework' ? 'framework' : 'auction'
    return {
      id: contract.id,
      type,
      typeLabel: typeLabelOf(template?.type ?? 'auction'),
      lotId: contract.lotId,
      auctionTitle: auctionTitleById.get(contract.lotId) ?? null,
      version: template?.version ?? null,
      status: contract.status,
      signedAt: contract.signedAt,
      href:
        type === 'framework'
          ? '/lepingud/raamleping'
          : `/lepingud/oksjonileping/${contract.lotId}`,
    }
  })

  const frameworkSignedRow = rows.find(
    (row) => row.type === 'framework' && row.status === 'signed',
  )

  return (
    <div className="flex flex-col gap-lg">
      <h1 className="font-heading text-h2 text-ink">Lepingud</h1>

      <Card hover={false} content={
        frameworkSignedRow ? (
          <div className="flex flex-wrap items-center justify-between gap-sm">
            <div className="flex flex-col gap-2xs">
              <span className="font-label font-semibold text-statusActive">
                Raamleping on allkirjastatud
              </span>
              <span className="font-body text-bodySm text-inkMuted">
                Jõus alates {fmtDate(frameworkSignedRow.signedAt) ?? 'allkirjastamise kuupäevast'}.
                Malli versiooni uuendused ei nõua korduvat allkirjastamist.
              </span>
            </div>
            <Link
              href="/lepingud/raamleping"
              className="inline-flex h-10 items-center justify-center rounded-button border border-primary px-4 font-label font-semibold text-primary transition-colors duration-hover hover:bg-primaryLight"
            >
              Vaata
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-sm">
            <div className="flex flex-col gap-2xs">
              <span className="font-label font-semibold text-ink">Raamleping on allkirjastamata</span>
              <span className="font-body text-bodySm text-inkMuted">
                Enne esimest pakkumist tuleb allkirjastada raamleping.
              </span>
            </div>
            <Link
              href="/lepingud/raamleping"
              className="inline-flex h-10 items-center justify-center rounded-button bg-primary px-4 font-label font-semibold text-white transition-colors duration-hover hover:bg-primaryDark"
            >
              Allkirjasta raamleping
            </Link>
          </div>
        )
      } />

      {rows.length === 0 ? (
        <div className="rounded-card border border-border bg-white p-lg text-center">
          <p className="font-body text-body text-inkMuted">
            Sul ei ole veel allkirjastatud lepinguid.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-white shadow-card">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border">
                {['Tüüp', 'Oksjon', 'Versioon', 'Staatus', 'Allkirjastatud', 'Tegevus'].map((heading) => (
                  <th key={heading} scope="col" className="px-md py-sm font-label font-semibold text-inkMuted">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-b-0">
                  <td className="px-md py-sm font-label font-semibold text-ink">{row.typeLabel}</td>
                  <td className="px-md py-sm">
                    {row.lotId !== null ? (
                      <Link
                        href={`/oksjon/${row.lotId}`}
                        className="font-body text-bodySm text-ink transition-colors duration-hover hover:text-primary"
                      >
                        {row.auctionTitle ?? 'Vaata oksjonit'}
                      </Link>
                    ) : (
                      <span className="text-inkMuted">—</span>
                    )}
                  </td>
                  <td className="px-md py-sm font-mono text-bodySm text-ink">
                    {row.version ?? '—'}
                  </td>
                  <td className="px-md py-sm">
                    <ContractPill status={row.status} />
                  </td>
                  <td className="px-md py-sm font-body text-bodySm text-inkMuted">
                    {fmtDate(row.signedAt) ?? '—'}
                  </td>
                  <td className="px-md py-sm">
                    <Link
                      href={row.href}
                      className="inline-flex h-8 items-center justify-center rounded-button border border-primary px-3 text-label font-semibold text-primary transition-colors duration-hover hover:bg-primaryLight"
                    >
                      Vaata
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
