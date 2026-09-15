import Link from 'next/link'

import { formatDate } from './format'

export interface ServiceRequestRow {
  id: string
  type: string
  status: string
  createdAt: string
}

const SERVICE_TYPE_LABELS: Record<string, string> = {
  kava: 'Metsamajanduskava',
  hooldusraie: 'Hooldusraie',
  istutamine: 'Metsa istutamine',
}

// Pill tones reuse the object-card vocabulary: Uus active green, Suunatud
// info blue, Teostatud primary, Suletud muted.
const STATUS_PILLS: Record<string, { label: string; className: string }> = {
  new: { label: 'Uus', className: 'bg-statusActive/10 text-statusActive' },
  routed: { label: 'Suunatud', className: 'bg-info/10 text-info' },
  teostatud: { label: 'Teostatud', className: 'bg-primaryLight text-primaryHover' },
  suletud: { label: 'Suletud', className: 'bg-bgMist text-inkMuted' },
}

function StatusPill({ status }: { status: string }) {
  const tone = STATUS_PILLS[status] ?? { label: status, className: 'bg-bgMist text-inkMuted' }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill px-3 py-[3px] text-[13px] font-semibold ${tone.className}`}
    >
      <span aria-hidden="true" className="size-[7px] rounded-full bg-current" />
      {tone.label}
    </span>
  )
}

const WIZARD_HREF = '/user/objects/paku'

// Server-rendered "Teenused" block for /user/objects. Rows carry only the
// display fields (type, status, createdAt) — routing details stay server-side.
export function ServiceRequestsSection({ rows }: { rows: ServiceRequestRow[] }) {
  return (
    <section
      aria-labelledby="service-requests-title"
      className="mx-auto w-full max-w-[1040px] pb-8 md:pb-10"
    >
      <h2 id="service-requests-title" className="mb-4 font-heading text-[22px] font-bold text-ink">
        Teenused
      </h2>
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2.5 rounded-card bg-primaryLight px-7 py-12 text-center">
          <h3 className="m-0 font-heading text-lg font-bold text-ink">Päringuid ei ole veel</h3>
          <p className="m-0 max-w-[34em] text-bodySm text-inkMuted">
            Siin näed oma esitatud teenustepäringuid. Alusta esimese päringu koostamist viisardiga.
          </p>
          <Link
            href={WIZARD_HREF}
            className="inline-flex h-10 items-center justify-center rounded-button border border-primary bg-transparent px-4 text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:bg-primaryLight motion-reduce:transition-none"
          >
            Koosta päring
          </Link>
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-bgPage p-[22px] shadow-card"
            >
              <div className="min-w-0">
                <span className="font-heading text-lg font-bold leading-[1.3] text-ink">
                  {SERVICE_TYPE_LABELS[row.type] ?? row.type}
                </span>
                <p className="m-0 mt-1 text-sm text-inkMuted">
                  Esitatud {formatDate(row.createdAt)}
                </p>
              </div>
              <StatusPill status={row.status} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
