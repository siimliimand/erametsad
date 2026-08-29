import Link from 'next/link'
import { notFound } from 'next/navigation'

import { updateContractStatusAction } from '../../../_actions/contracts'
import { ErrorNotice } from '../../../_components/ErrorNotice'
import { secondaryButtonClass } from '../../../_components/FormField'
import { PageHeader } from '../../../_components/PageHeader'
import { requireAdminRepositories } from '../../../_lib/admin'
import { ContractStatusPill, formatDateTime } from '../../../_lib/labels'

import type { UserDoc } from '@/lib/data/repositories'

export const metadata = { title: 'Leping' }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-label font-semibold text-ink">{label}</span>
      <p className="rounded-input border border-border bg-bg-mist px-3 py-2 text-bodySm text-ink-muted">
        {children}
      </p>
    </div>
  )
}

const transitionButtons: Readonly<Record<string, readonly { status: string; label: string }[]>> = {
  prepared: [
    { status: 'sent', label: 'Märgi saadetuks' },
    { status: 'signed', label: 'Märgi allkirjastatuks' },
    { status: 'voided', label: 'Tühista leping' },
  ],
  sent: [
    { status: 'signed', label: 'Märgi allkirjastatuks' },
    { status: 'voided', label: 'Tühista leping' },
  ],
  signed: [],
  voided: [],
}

export default async function ContractDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ viga?: string }>
}) {
  const { id } = await params
  const { viga } = await searchParams
  const { repositories } = await requireAdminRepositories()

  const contract = await repositories.findByID({ collection: 'contracts', id })
  if (!contract) notFound()

  const [template, auction] = await Promise.all([
    repositories.findByID({ collection: 'contract-templates', id: contract.templateId }),
    repositories.findByID({ collection: 'auctions', id: contract.lotId }),
  ])

  const winningBid = auction?.winningBid
    ? (await repositories.find({ collection: 'bids', where: { id: { equals: auction.winningBid } }, limit: 1 }))
        .docs[0]
    : undefined

  const partyIds = [auction?.sellerId, winningBid?.userId, contract.signedBy].filter(
    (partyId): partyId is string => !!partyId,
  )
  const parties: UserDoc[] =
    partyIds.length > 0
      ? (
          await repositories.find({
            collection: 'users',
            where: { id: { in: partyIds } },
            pagination: false,
          })
        ).docs
      : []
  const partyLabel = new Map(parties.map((party) => [party.id, party.name ?? party.email]))

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title={auction?.title ?? 'Leping'}
        description="Lepingu andmed ja oleku üleminekud."
        backHref="/admin/contracts"
      />
      <div className="max-w-container-sm space-y-sm rounded-card border border-border bg-bgPage p-md">
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          <Field label="Olek">
            <ContractStatusPill status={contract.status} />
          </Field>
          <Field label="Mall">
            {template ? `${template.name} (v${template.version})` : contract.templateId}
          </Field>
          <Field label="Oksjon">{auction?.title ?? contract.lotId}</Field>
          <Field label="Müüja">
            {auction?.sellerId ? (
              <Link
                href={`/admin/users/${auction.sellerId}`}
                className="font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryHover"
              >
                {partyLabel.get(auction.sellerId) ?? auction.sellerId}
              </Link>
            ) : (
              '—'
            )}
          </Field>
          <Field label="Ostja (võitja)">
            {winningBid ? (
              <Link
                href={`/admin/users/${winningBid.userId}`}
                className="font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryHover"
              >
                {partyLabel.get(winningBid.userId) ?? winningBid.userId}
              </Link>
            ) : (
              '—'
            )}
          </Field>
          <Field label="Allkirjastatud">{formatDateTime(contract.signedAt)}</Field>
          <Field label="Allkirjastaja">
            {contract.signedBy ? (partyLabel.get(contract.signedBy) ?? contract.signedBy) : '—'}
          </Field>
          <Field label="Sisu räsi">
            <span className="font-mono text-bodySm break-all">{contract.contentHash ?? '—'}</span>
          </Field>
          <Field label="Loodud">{formatDateTime(contract.createdAt)}</Field>
        </div>

        <div className="flex flex-wrap items-center gap-sm pt-xs">
          {transitionButtons[contract.status]?.map((button) => (
            <form key={button.status} action={updateContractStatusAction}>
              <input type="hidden" name="id" value={contract.id} />
              <input type="hidden" name="status" value={button.status} />
              <button
                type="submit"
                className={
                  button.status === 'voided'
                    ? 'inline-flex h-10 items-center rounded-button border border-danger bg-bgPage px-4 text-label font-semibold text-danger transition-colors duration-hover ease-hover hover:bg-danger-light'
                    : secondaryButtonClass
                }
              >
                {button.label}
              </button>
            </form>
          ))}
          {transitionButtons[contract.status]?.length === 0 ? (
            <p className="text-bodySm text-ink-muted">Leping on lõppolekus, üleminekuid pole.</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
