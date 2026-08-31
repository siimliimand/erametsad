import { Accordion } from '@eametsad/ui'
import Link from 'next/link'
import type { ReactElement, SVGProps } from 'react'

import type { SettingsDoc } from '@/lib/data/repositories'
import { getRepositories } from '@/lib/data/runtime'
import {
  auctionObjectTypes,
  type AuctionObjectType,
  type LegalDocument,
} from '@/lib/data/schema'
import { PORTAL_HOSTNAME } from '@/lib/routing/host-areas'

// Mirrors the portal listing tabs (ListingTabs.tsx); keyed by the auctions
// schema's objectType so a schema change fails the typecheck here. Tabs
// without a schema type (põllumaad) stay out of the footer.
const AUCTION_NAV: Record<AuctionObjectType, { label: string; tab: string }> = {
  raieoigus: { label: 'Raieõigused', tab: 'raieoigused' },
  kinnistu: { label: 'Metskinnistud', tab: 'metskinnistud' },
  kiire: { label: 'Kiiroksjonid', tab: 'kiiroksjonid' },
  pakett: { label: 'Paketid', tab: 'paketid' },
}

// Contract for task 2.4: the admin uploads the usage-guide PDF to media
// under this filename; until that record exists the link must not render.
const KASUTUSJUHEND_FILENAME = 'kasutusjuhend.pdf'

function portalUrl(path: string): string {
  return `https://${PORTAL_HOSTNAME}${path}`
}

interface FooterLink {
  label: string
  href: string
  external?: boolean
}

interface FooterSection {
  id: string
  title: string
  links: FooterLink[]
  /** Icons render as an icon row (aria-label per link) instead of a list. */
  variant?: 'icons'
}

const ARTIKKEL_LINKS: FooterLink[] = [
  { label: 'Uudised', href: '/artiklid/uudised' },
  { label: 'Klientide lood', href: '/artiklid/klientide-lood' },
]

// Settings owns the social URLs once the schema gains org social columns;
// a null href renders no icon (no empty anchors).
const SOCIAL_LINKS: readonly { label: string; href: string | null }[] = [
  { label: 'Facebook', href: null },
  { label: 'Instagram', href: null },
  { label: 'YouTube', href: null },
]

// Inline Lucide-geometry brand icons (ISC): apps/platform does not declare
// lucide-react as a direct dependency (see (admin)/_components/icons.tsx).
function SocialSvg({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

type SocialIcon = (props: SVGProps<SVGSVGElement>) => ReactElement

const SOCIAL_ICONS: Record<string, SocialIcon> = {
  Facebook: (props) => (
    <SocialSvg {...props}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </SocialSvg>
  ),
  Instagram: (props) => (
    <SocialSvg {...props}>
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </SocialSvg>
  ),
  YouTube: (props) => (
    <SocialSvg {...props}>
      <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
      <path d="m10 15 5-3-5-3z" />
    </SocialSvg>
  ),
}

function auctionLinks(kind: 'active' | 'history'): FooterLink[] {
  return auctionObjectTypes.map((objectType) => ({
    label: AUCTION_NAV[objectType].label,
    href:
      kind === 'active'
        ? portalUrl(`/?tab=${AUCTION_NAV[objectType].tab}`)
        : portalUrl(`/ajalugu?tab=${AUCTION_NAV[objectType].tab}`),
    external: true,
  }))
}

// No per-document detail page exists: legal_documents rows render on the
// /lepingud/dokumendid list page, so both links point there.
function legalLink(doc: LegalDocument | undefined, label: string): FooterLink | null {
  return doc ? { label, href: '/lepingud/dokumendid' } : null
}

function buildSections(
  settings: SettingsDoc | undefined,
  privacy: LegalDocument | undefined,
  terms: LegalDocument | undefined,
  guideUrl: string | null,
): FooterSection[] {
  const guideLink: FooterLink | null = guideUrl
    ? { label: 'Kasutusjuhend', href: guideUrl, external: true }
    : null
  const usefulLinks = [
    guideLink,
    { label: 'Lepingud', href: '/lepingud' },
    legalLink(terms, 'Kasutustingimused'),
    legalLink(privacy, 'Privaatsuspoliitika'),
  ].filter((link): link is FooterLink => link !== null)

  const socialLinks: FooterLink[] = SOCIAL_LINKS.flatMap((social) =>
    social.href === null ? [] : [{ label: social.label, href: social.href, external: true }],
  )

  const sections: FooterSection[] = [
    { id: 'aktiivsed', title: 'Aktiivsed oksjonid', links: auctionLinks('active') },
    { id: 'ajalugu', title: 'Oksjonite ajalugu', links: auctionLinks('history') },
    { id: 'artiklid', title: 'Artiklid', links: ARTIKKEL_LINKS },
    { id: 'kasulik', title: 'Kasulik teada', links: usefulLinks },
    { id: 'jalgi', title: 'Jälgi meid', links: socialLinks, variant: 'icons' },
  ]
  return sections.filter((section) => section.links.length > 0)
}

function FooterNavLink({ link }: { link: FooterLink }) {
  const className =
    'text-white/70 transition-colors duration-hover ease-hover hover:text-white'
  if (link.external) {
    return (
      <a href={link.href} target="_blank" rel="noopener" className={className}>
        {link.label}
      </a>
    )
  }
  return (
    <Link href={link.href} className={className}>
      {link.label}
    </Link>
  )
}

function FooterSectionLinks({ links }: { links: FooterLink[] }) {
  return (
    <ul className="flex flex-col gap-xs">
      {links.map((link) => (
        <li key={`${link.label}-${link.href}`}>
          <FooterNavLink link={link} />
        </li>
      ))}
    </ul>
  )
}

function FooterSectionContent({ section }: { section: FooterSection }) {
  if (section.variant !== 'icons') {
    return <FooterSectionLinks links={section.links} />
  }
  return (
    <div className="flex gap-sm">
      {section.links.map((link) => {
        const Icon = SOCIAL_ICONS[link.label]
        return (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noopener"
            aria-label={link.label}
            className="text-white/70 transition-colors duration-hover ease-hover hover:text-white"
          >
            {Icon ? <Icon className="h-5 w-5" /> : link.label}
          </a>
        )
      })}
    </div>
  )
}

export async function MarketingFooter() {
  const repos = await getRepositories()
  const [settingsResult, privacyResult, termsResult, guideResult] = await Promise.all([
    repos.find({ collection: 'settings', limit: 1 }),
    repos.find({
      collection: 'legal-documents',
      where: { type: { equals: 'privacy' }, status: { equals: 'published' } },
      limit: 1,
    }),
    repos.find({
      collection: 'legal-documents',
      where: { type: { equals: 'terms' }, status: { equals: 'published' } },
      limit: 1,
    }),
    repos.find({
      collection: 'media',
      where: {
        filename: { equals: KASUTUSJUHEND_FILENAME },
        status: { equals: 'published' },
        url: { exists: true },
      },
      limit: 1,
    }),
  ])

  const settings = settingsResult.docs[0]
  const guideMedia = guideResult.docs[0]
  const sections = buildSections(
    settings,
    privacyResult.docs[0],
    termsResult.docs[0],
    guideMedia?.url ?? null,
  )

  return (
    <footer className="bg-primaryDark text-inkInverse">
      <div className="mx-auto w-full max-w-container-xl px-md py-xl lg:px-lg">
        {/* Desktop: link columns. */}
        <nav
          aria-label="Jaluse lingid"
          className="hidden gap-lg md:grid md:grid-cols-5"
        >
          {sections.map((section) => (
            <div key={section.id} className="flex flex-col gap-sm">
              <h2 className="font-heading text-bodySm font-semibold text-white">
                {section.title}
              </h2>
              <FooterSectionContent section={section} />
            </div>
          ))}
        </nav>

        {/* Mobile: the same columns collapse into accordions. */}
        <div className="text-inkInverse md:hidden">
          <Accordion
            variant="multi"
            items={sections.map((section) => ({
              id: section.id,
              title: section.title,
              content: <FooterSectionContent section={section} />,
            }))}
          />
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-container-xl flex-col gap-sm px-md py-md text-bodySm text-white/70 md:flex-row md:items-center md:justify-between md:px-lg">
          <p>
            © {new Date().getFullYear()}
            {settings?.orgName ? ` ${settings.orgName}` : ''}
            {settings?.orgRegCode ? ` · Registrikood ${settings.orgRegCode}` : ''}
            {settings?.orgAddress ? ` · ${settings.orgAddress}` : ''}
          </p>
          <nav aria-label="Juriidiline teave" className="flex items-center gap-md">
            {privacyResult.docs[0] !== undefined && (
              <Link
                href="/lepingud/dokumendid"
                className="transition-colors duration-hover ease-hover hover:text-white"
              >
                Privaatsuspoliitika
              </Link>
            )}
            {/* Task 2.4 contract: the consent modal opens from the
                [data-cookie-settings] control; until that listener mounts,
                the button stays inert. */}
            <button
              type="button"
              data-cookie-settings
              aria-haspopup="dialog"
              className="transition-colors duration-hover ease-hover hover:text-white"
            >
              Küpsiste sätete muutmine
            </button>
          </nav>
        </div>
      </div>
    </footer>
  )
}
