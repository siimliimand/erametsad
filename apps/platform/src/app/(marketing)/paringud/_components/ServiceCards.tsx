import { ClipboardList, Sprout, TreePine } from 'lucide-react'
import Link from 'next/link'

import type { ServiceRequestType } from '@/lib/data/schema'

export type ServiceCounts = Record<ServiceRequestType, number>

interface ServiceCardMeta {
  type: ServiceRequestType
  title: string
  description: string
  href: string
  icon: typeof ClipboardList
}

// Static card copy from spec 09. The partner_services CMS table may be
// empty, so the hub never depends on it for card metadata; CMS-driven
// overrides can layer on top once admin content exists.
export const SERVICES: readonly ServiceCardMeta[] = [
  {
    type: 'kava',
    title: 'Metsamajanduskava',
    description: 'Kava on raiete ja toetuste alus.',
    href: '/paringud/metsamajanduskava',
    icon: ClipboardList,
  },
  {
    type: 'hooldusraie',
    title: 'Hooldusraie',
    description: 'Hooldus- ja valgusraie korraldamine.',
    href: '/paringud/hooldusraie',
    icon: TreePine,
  },
  {
    type: 'istutamine',
    title: 'Metsa istutamine',
    description: 'Maa ettevalmistus, istikud, istutamine.',
    href: '/paringud/metsa-istutamine',
    icon: Sprout,
  },
]

// The whole card is the link (spec 09 a11y: screen readers announce the
// aria-label "Esita päring — <teenus>"), so the visual button is a span.
const cardLinkClass =
  'group flex flex-col items-start rounded-card border border-border bg-bgPage p-6 shadow-card transition-all duration-hover ease-hover hover:border-primary hover:shadow-card-hover motion-reduce:transition-none'
const cardDisabledClass =
  'flex flex-col items-start rounded-card border border-statusEnded bg-bgPage p-6 shadow-card'
const btnOutlineClass =
  'mt-auto inline-flex h-10 items-center justify-center rounded-button border border-primary px-4 font-label font-semibold text-primary transition-colors duration-hover ease-hover group-hover:bg-primary-light motion-reduce:transition-none'
const btnDisabledClass =
  'mt-auto inline-flex h-10 items-center justify-center rounded-button border border-statusEnded px-4 font-label font-semibold text-statusEnded'

export function ServiceCards({ counts }: { counts: ServiceCounts }) {
  return (
    <div className="grid gap-md md:grid-cols-3">
      {SERVICES.map(({ type, title, description, href, icon: Icon }) => {
        if (counts[type] === 0) {
          return (
            <div key={type} aria-disabled="true" className={cardDisabledClass}>
              <span className="flex h-12 w-12 items-center justify-center rounded-card bg-bgMist text-statusEnded">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <h3 className="mt-xs font-heading text-h4 text-statusEnded">{title}</h3>
              <p className="mt-2xs text-bodySm text-statusEnded">{description}</p>
              <span className={btnDisabledClass}>Hetkel pole saadaval</span>
            </div>
          )
        }
        return (
          <Link
            key={type}
            href={href}
            aria-label={`Esita päring — ${title}`}
            className={cardLinkClass}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-card bg-primaryLight text-primaryDark">
              <Icon className="h-6 w-6" aria-hidden="true" />
            </span>
            <h3 className="mt-xs font-heading text-h4 text-ink">{title}</h3>
            <p className="mt-2xs text-bodySm text-inkMuted">{description}</p>
            <span className={btnOutlineClass}>Esita päring</span>
          </Link>
        )
      })}
    </div>
  )
}
