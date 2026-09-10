import {
  ArrowRight,
  ChevronRight,
  FileCheck,
  FileText,
  PenLine,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { ContractPill } from './_components/contract-pill'
import { loadUserSigningContracts } from './_components/contract-state'

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

const FRAMEWORK_HREF = '/lepingud/raamleping'

export default async function LepingudPage() {
  const { session } = await requirePortalSession('/lepingud')

  // Contract rows carry no owner on the mock service except signedBy, so the
  // list scopes to the caller's rows: prepare binds the owner at creation, so
  // in-progress (prepared/sent) contracts list above signed ones. Auction and
  // template lookups run as system context because the guard's published-only
  // filter would hide ended lots.
  const systemRepos = await getRepositories()
  const inProgressContracts = await loadUserSigningContracts(systemRepos, session.userId)
  const signedResult = await systemRepos.find({
    collection: 'contracts',
    where: {
      and: [
        { signedBy: { equals: session.userId } },
        { status: { equals: 'signed' } },
      ],
    },
    sort: '-createdAt',
  })
  const contracts = [...inProgressContracts, ...signedResult.docs]

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
          ? FRAMEWORK_HREF
          : `/lepingud/oksjonileping/${contract.lotId}`,
    }
  })

  const frameworkSignedRow = rows.find(
    (row) => row.type === 'framework' && row.status === 'signed',
  )

  // Demo page-head band (D10): /lepingud has no demo mockup, so the head
  // reuses the Minu keskkond head language (UserPageHead) minus the tab row —
  // Lepingud stays reachable from the header dropdown and the footer (D9).
  return (
    <>
      <section
        aria-labelledby="lepingud-title"
        className="-mx-md -mt-lg bg-bgMist px-md pb-[28px] pt-[32px] md:-mx-lg md:px-lg md:pb-[40px] md:pt-[48px]"
      >
        <nav
          aria-label="Asukoht"
          className="mb-3.5 flex items-center gap-2 overflow-x-auto whitespace-nowrap text-bodySm text-inkMuted"
        >
          <Link
            href="/user/bids"
            className="transition-colors duration-hover ease-hover hover:text-primary hover:underline motion-reduce:transition-none"
          >
            Minu keskkond
          </Link>
          <ChevronRight aria-hidden="true" size={11} className="shrink-0" />
          <span aria-current="page" className="font-semibold text-ink">
            Lepingud
          </span>
        </nav>
        <h1
          id="lepingud-title"
          className="mb-[10px] font-heading text-[34px] font-extrabold leading-[1.15] text-ink md:text-h1"
        >
          Lepingud
        </h1>
        <p className="max-w-[52em] font-body text-body text-inkMuted md:text-[18px]">
          Siin on sinu raamleping ja oksjonilepingud. Allkirjasta ootel
          lepingud või vaata allkirjastatud dokumente.
        </p>
      </section>

      <div className="flex flex-col gap-md pt-[32px]">
        <div className="flex flex-wrap items-center gap-md rounded-card border border-border bg-white p-md shadow-card">
          <span
            className={`flex h-12 w-12 flex-none items-center justify-center rounded-card ${
              frameworkSignedRow ? 'bg-primaryLight text-primary' : 'bg-bgMist text-inkMuted'
            }`}
          >
            {frameworkSignedRow ? (
              <FileCheck aria-hidden="true" size={24} />
            ) : (
              <PenLine aria-hidden="true" size={24} />
            )}
          </span>
          <div className="flex min-w-[260px] flex-1 flex-col gap-2xs">
            {frameworkSignedRow ? (
              <>
                <span className="font-heading text-h4 font-bold text-statusActive">
                  Raamleping on allkirjastatud
                </span>
                <span className="font-body text-bodySm text-inkMuted">
                  Jõus alates {fmtDate(frameworkSignedRow.signedAt) ?? 'allkirjastamise kuupäevast'}.
                  Malli versiooni uuendused ei nõua korduvat allkirjastamist.
                </span>
              </>
            ) : (
              <>
                <span className="font-heading text-h4 font-bold text-ink">
                  Raamleping on allkirjastamata
                </span>
                <span className="font-body text-bodySm text-inkMuted">
                  Enne esimest pakkumist tuleb allkirjastada raamleping.
                </span>
              </>
            )}
          </div>
          {frameworkSignedRow ? (
            <Link
              href={FRAMEWORK_HREF}
              className="inline-flex h-10 flex-none items-center justify-center rounded-button border border-primary px-4 font-label font-semibold text-primary transition-colors duration-hover ease-hover hover:bg-primaryLight motion-reduce:transition-none"
            >
              Vaata
            </Link>
          ) : (
            <Link
              href={FRAMEWORK_HREF}
              className="inline-flex h-10 flex-none items-center justify-center rounded-button bg-primary px-4 font-label font-semibold text-inkInverse transition-colors duration-hover ease-hover hover:bg-primaryHover motion-reduce:transition-none"
            >
              Allkirjasta raamleping
            </Link>
          )}
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center rounded-card border border-border bg-white px-4 py-16 text-center shadow-card">
            <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-pill bg-bgMist">
              <FileText aria-hidden="true" className="h-8 w-8 text-inkMuted" />
            </span>
            <h2 className="font-heading text-h4 font-bold text-ink">Lepinguid pole</h2>
            <p className="mt-2 max-w-[34em] font-body text-bodySm text-inkMuted">
              Sul ei ole veel lepinguid. Enne esimest pakkumist tuleb
              allkirjastada raamleping.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-card border border-border bg-white shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-border bg-bgMist">
                    {['Tüüp', 'Oksjon', 'Versioon', 'Staatus', 'Allkirjastatud', 'Tegevus'].map(
                      (heading) => (
                        <th
                          key={heading}
                          scope="col"
                          className="px-md py-3 font-label font-semibold uppercase tracking-[0.04em] text-inkMuted"
                        >
                          {heading}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const inProgress = row.status === 'prepared' || row.status === 'sent'
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-border transition-colors duration-hover ease-hover last:border-b-0 hover:bg-bgMist motion-reduce:transition-none"
                      >
                        <td className="px-md py-sm font-heading text-bodySm font-bold text-ink">
                          {row.typeLabel}
                        </td>
                        <td className="px-md py-sm">
                          {row.lotId !== null ? (
                            <Link
                              href={`/oksjon/${row.lotId}`}
                              className="font-body text-bodySm font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryHover motion-reduce:transition-none"
                            >
                              {row.auctionTitle ?? 'Vaata oksjonit'}
                            </Link>
                          ) : (
                            <span className="font-body text-bodySm text-inkMuted">—</span>
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
                          {inProgress ? (
                            <Link
                              href={row.href}
                              className="inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-button bg-primary px-3 text-label font-semibold text-inkInverse transition-colors duration-hover ease-hover hover:bg-primaryHover motion-reduce:transition-none"
                            >
                              Jätka
                              <ArrowRight aria-hidden="true" size={14} />
                            </Link>
                          ) : (
                            <Link
                              href={row.href}
                              className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-button border border-primary px-3 text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:bg-primaryLight motion-reduce:transition-none"
                            >
                              Vaata
                            </Link>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
