import { ExternalLink } from 'lucide-react'

import { SpeciesCodes, type DossierRow } from './DossierTable'

export interface FactsLink {
  label: string
  href: string
}

export interface FactsCardProps {
  rows: DossierRow[]
  links: FactsLink[]
}

// Demo sealed Põhiandmed card (docs/design/demo/portal/03-lot-detail-sealed.html
// .detail-card + .facts): two-column key/value rows with a final "Lingid" row
// of external Katastrikaart/Metsaregister links.
export function FactsCard({ rows, links }: FactsCardProps) {
  return (
    <section
      aria-labelledby="facts-card-heading"
      className="rounded-card border border-border bg-bgPage p-7 shadow-card"
    >
      <h2
        id="facts-card-heading"
        className="mb-[18px] font-heading text-h3 text-ink"
      >
        Põhiandmed
      </h2>
      <dl className="m-0 grid grid-cols-1 gap-x-10 sm:grid-cols-2 [&>div:nth-last-child(1)]:border-b-0 [&>div:nth-last-child(2):nth-child(odd)]:border-b-0">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex justify-between gap-4 border-b border-border py-[11px]"
          >
            <dt className="text-bodySm text-inkMuted">{row.label}</dt>
            <dd className="m-0 text-right text-bodySm font-semibold text-ink">
              {row.label === 'Puuliigid' ? (
                <SpeciesCodes value={row.value} />
              ) : row.mono === true ? (
                <span className="font-mono font-medium">{row.value}</span>
              ) : (
                row.value
              )}
            </dd>
          </div>
        ))}
        {links.length > 0 && (
          <div className="flex justify-between gap-4 border-b border-border py-[11px]">
            <dt className="text-bodySm text-inkMuted">Lingid</dt>
            <dd className="m-0 text-right text-bodySm font-semibold">
              {links.map((link, index) => (
                <span key={link.href}>
                  {index > 0 && <span className="text-inkMuted"> · </span>}
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary transition-colors duration-hover hover:text-primaryHover"
                  >
                    {link.label}
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                </span>
              ))}
            </dd>
          </div>
        )}
      </dl>
    </section>
  )
}
