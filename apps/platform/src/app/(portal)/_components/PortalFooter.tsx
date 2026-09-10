'use client'

import Link from 'next/link'
import type { ReactElement, SVGProps } from 'react'

import { marketingUrl } from '@/app/(marketing)/_lib/base-url'

// CookieBanner (task 1.4) reopens when this event fires on document.
const OPEN_COOKIE_SETTINGS_EVENT = 'erametsad:open-cookie-settings'

// Lucide removed its brand icons, so the Facebook/Instagram/YouTube geometry
// ships inline (ISC), same as MarketingFooter.
type SocialIcon = (props: SVGProps<SVGSVGElement>) => ReactElement

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

const FacebookIcon: SocialIcon = (props) => (
  <SocialSvg {...props}>
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </SocialSvg>
)

const InstagramIcon: SocialIcon = (props) => (
  <SocialSvg {...props}>
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </SocialSvg>
)

const YoutubeIcon: SocialIcon = (props) => (
  <SocialSvg {...props}>
    <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
    <path d="m10 15 5-3-5-3z" />
  </SocialSvg>
)

interface FooterLink {
  label: string
  href: string
  /** Absolute marketing-host target; rendered as a plain anchor. */
  external?: boolean
}

interface FooterColumn {
  title: string
  links: FooterLink[]
}

// Demo footer (docs/design/demo/portal/01-listing.html): portal routes stay
// internal; Erametsad content links to the marketing host per task 1.2.
// D9: Lepingud stays reachable from the footer, in the Oksjonid column.
const columns: FooterColumn[] = [
  {
    title: 'Oksjonid',
    links: [
      { label: 'Raieõigused', href: '/?tab=raieoigused' },
      { label: 'Metskinnistud', href: '/?tab=metskinnistud' },
      { label: 'Põllumaad', href: '/?tab=polumaad' },
      { label: 'Paketid', href: '/?tab=paketid' },
      { label: 'Kiiroksjonid', href: '/?tab=kiiroksjonid' },
      { label: 'Lepingud', href: '/lepingud' },
    ],
  },
  {
    title: 'Ajalugu',
    links: [
      { label: 'Lõppenud oksjonid', href: '/ajalugu' },
      { label: 'Tulemused', href: '/ajalugu' },
    ],
  },
  {
    title: 'Erametsad',
    links: [
      { label: 'Metsa müümine', href: marketingUrl('/'), external: true },
      {
        label: 'Hindamisaktid',
        href: marketingUrl('/hindamisaktid'),
        external: true,
      },
      {
        label: 'Metsateatis',
        href: marketingUrl('/metsateatis'),
        external: true,
      },
      {
        label: 'Metsaspetsialistid',
        href: marketingUrl('/meist/metsaspetsialistid'),
        external: true,
      },
      { label: 'KKK', href: marketingUrl('/kkk'), external: true },
    ],
  },
]

// Demo social targets; the CMS social columns do not exist yet.
const socialLinks: { label: string; href: string; icon: SocialIcon }[] = [
  { label: 'Facebook', href: 'https://facebook.com/erametsad', icon: FacebookIcon },
  {
    label: 'Instagram',
    href: 'https://instagram.com/erametsad',
    icon: InstagramIcon,
  },
  { label: 'YouTube', href: 'https://youtube.com/@erametsad', icon: YoutubeIcon },
]

// Demo .footer-grid a: 15px links at 72% white, hover to full white.
const columnLinkClass =
  'block py-[5px] text-[15px] text-white/70 transition-colors duration-hover ease-hover hover:text-white'

// Demo .social-row a: 40px circle, 25% white border, icon at 18px.
const socialLinkClass =
  'flex h-10 w-10 items-center justify-center rounded-full border border-white/25 text-white/70 transition-colors duration-hover ease-hover hover:border-white hover:bg-white/10 hover:text-white'

// Demo .footer-bottom: 14px copy at 72% white above a 14% white divider.
const bottomLinkClass =
  'transition-colors duration-hover ease-hover hover:text-white'

export function PortalFooter() {
  const openCookieSettings = () => {
    document.dispatchEvent(new CustomEvent(OPEN_COOKIE_SETTINGS_EVENT))
  }

  return (
    <footer className="bg-primaryDark pt-16 pb-8 text-inkInverse">
      <div className="mx-auto w-full max-w-container-xl px-md md:px-lg">
        <div className="mb-12 grid grid-cols-2 gap-8 md:grid-cols-4">
          {columns.map((column) => (
            <div key={column.title}>
              <h2 className="mb-3.5 font-heading text-body font-bold text-white">
                {column.title}
              </h2>
              <nav aria-label={column.title}>
                {column.links.map((link) =>
                  link.external ? (
                    <a
                      key={link.label}
                      href={link.href}
                      className={columnLinkClass}
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      key={link.label}
                      href={link.href}
                      className={columnLinkClass}
                    >
                      {link.label}
                    </Link>
                  ),
                )}
              </nav>
            </div>
          ))}
          <div>
            <h2 className="mb-3.5 font-heading text-body font-bold text-white">
              Jälgi meid
            </h2>
            <div className="flex gap-2.5">
              {socialLinks.map((social) => {
                const Icon = social.icon
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener"
                    aria-label={social.label}
                    className={socialLinkClass}
                  >
                    <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
                  </a>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/15 pt-6 text-bodySm text-white/70">
          <p>© {new Date().getFullYear()} Erametsad OÜ</p>
          <nav
            aria-label="Juriidiline teave"
            className="ml-auto flex items-center gap-x-6"
          >
            {/* No per-document page exists: legal_documents rows render on
                the marketing /lepingud/dokumendid list. */}
            <a
              href={marketingUrl('/lepingud/dokumendid')}
              className={bottomLinkClass}
            >
              Privaatsuspoliitika
            </a>
            <button
              type="button"
              onClick={openCookieSettings}
              className={bottomLinkClass}
            >
              Küpsisesätted
            </button>
          </nav>
        </div>
      </div>
    </footer>
  )
}
