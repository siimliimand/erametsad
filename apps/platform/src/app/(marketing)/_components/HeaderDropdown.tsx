'use client'

import {
  ChevronDown,
  ClipboardList,
  ExternalLink,
  FileText,
  Map,
  Ruler,
  TreePine,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import { MobileNav } from './MobileNav'

import { track } from '@/lib/analytics/track'
import { PORTAL_HOSTNAME } from '@/lib/routing/host-areas'

export interface HeaderFaqCategory {
  slug: string
  title: string
}

export interface NavLeafLink {
  label: string
  href: string
  icon?: LucideIcon
  // Renders a divider line above the item (design: last 2 Metsa müümine
  // subpages are separated).
  separated?: boolean
}

// Prototype host mirrors the PORTAL_HOSTNAME pattern; production cutover
// is metsauhistu.erametsad.ee.
const UHISTU_URL = 'https://metsauhistu.erametsad.ww0.dev'
const PORTAL_URL = `https://${PORTAL_HOSTNAME}`

export const SERVICE_LINKS: NavLeafLink[] = [
  { label: 'Raieõiguse müük', href: '/teenused/raieoiguse-muuk', icon: TreePine },
  { label: 'Kinnistu müük', href: '/teenused/kinnistu-muuk', icon: Map },
  { label: 'Metsa hindamine', href: '/teenused/metsa-hindamine', icon: Ruler },
  { label: 'Metsateatis', href: '/metsateatis', icon: FileText, separated: true },
  { label: 'Hindamisaktid', href: '/hindamisaktid', icon: ClipboardList },
]

export const PARINGUD_LINKS: NavLeafLink[] = [
  { label: 'Metsamajanduskava', href: '/paringud/metsamajanduskava' },
  { label: 'Hooldusraie', href: '/paringud/hooldusraie' },
  { label: 'Metsa istutamine', href: '/paringud/metsa-istutamine' },
]

export const MEIST_LINKS: NavLeafLink[] = [
  { label: 'Metsaspetsialistid', href: '/meist/metsaspetsialistid' },
]

// Same rule as the portal headers: exact match or a child path of href.
function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

interface NavGroupSpec {
  key: string
  label: string
  // Hub page the trigger navigates to; null means the trigger is a plain
  // toggle button (the group has no hub page).
  hubHref: string | null
  items: NavLeafLink[]
  // The group is active when any of these paths matches the current one.
  activeHrefs: string[]
}

const CTA_CLASS =
  'inline-flex h-10 items-center justify-center rounded-button bg-cta px-4 font-label text-bodySm font-semibold text-ink transition-all duration-hover ease-hover hover:bg-cta-hover motion-reduce:transition-none'

const EXTERNAL_CLASS =
  'inline-flex items-center gap-1 font-heading text-body font-semibold text-ink transition-colors duration-hover hover:text-primary'

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-xs" aria-label="Erametsad — avaleht">
      <svg viewBox="0 0 24 24" className="h-7 w-7 text-primaryDark" fill="currentColor" aria-hidden="true">
        <path d="M12 1.5 5.5 10.5h3.7L4 17.5h6.2v4h3.6v-4H20l-5.2-7h3.7L12 1.5z" />
      </svg>
      <span className="font-heading text-h4 font-extrabold text-primaryDark">Erametsad</span>
    </Link>
  )
}

export function HeaderDropdown({ categories }: { categories: HeaderFaqCategory[] }) {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [openGroup, setOpenGroup] = useState<string | null>(null)

  // Sticky header shrinks 72 -> 60 px on scroll (desktop only, design 00 §1).
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  // Dropdowns close on Esc and on any click outside the menu items.
  useEffect(() => {
    if (openGroup === null) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenGroup(null)
    }
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element) || !target.closest('[data-nav-group]')) {
        setOpenGroup(null)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onMouseDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onMouseDown)
    }
  }, [openGroup])

  const groups: NavGroupSpec[] = [
    {
      key: 'metsa-muuamine',
      label: 'Metsa müümine',
      hubHref: null,
      items: SERVICE_LINKS,
      activeHrefs: SERVICE_LINKS.map((link) => link.href),
    },
    {
      key: 'kkk',
      label: 'KKK',
      hubHref: '/kkk',
      // CMS categories arrive server-side; without them the KKK item
      // degrades to a plain link to the hub.
      items: categories.map((category) => ({
        label: category.title,
        href: `/kkk/${category.slug}`,
      })),
      activeHrefs: ['/kkk'],
    },
    {
      key: 'paringud',
      label: 'Päringud',
      hubHref: '/paringud',
      items: PARINGUD_LINKS,
      activeHrefs: ['/paringud'],
    },
    {
      key: 'meist',
      label: 'Meist',
      hubHref: '/meist',
      items: MEIST_LINKS,
      activeHrefs: ['/meist'],
    },
  ]

  // Shell analytics (design 00 §SEO): nav_click{item} on menu links,
  // outbound_click{portal|uhistu} on external targets.
  const trackNavClick = (item: string) => () => {
    track('nav_click', { item })
  }
  const trackOutbound = (target: 'portal' | 'uhistu') => () => {
    track('outbound_click', { target })
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[rgba(27,33,29,0.08)] bg-white">
      <div
        className={`mx-auto flex h-14 w-full max-w-container-xl items-center justify-between px-md transition-[height] duration-hover ease-hover md:px-lg motion-reduce:transition-none ${
          scrolled ? 'md:h-[60px]' : 'md:h-[72px]'
        }`}
      >
        <Logo />

        <nav aria-label="Peamenüü" className="hidden h-full items-center gap-md md:flex">
          <ul className="flex h-full items-center gap-md">
            {groups.map((group) => {
              const hasDropdown = group.items.length > 0
              const open = openGroup === group.key
              const active = group.activeHrefs.some((href) => isActive(pathname, href))
              const triggerClass = `relative flex h-full items-center gap-1 font-heading text-body font-semibold transition-colors duration-hover hover:text-primary ${
                active
                  ? 'text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary'
                  : 'text-ink'
              }`

              return (
                <li
                  key={group.key}
                  data-nav-group
                  className="relative flex h-full items-center"
                  onMouseEnter={
                    hasDropdown
                      ? () => {
                          setOpenGroup(group.key)
                        }
                      : undefined
                  }
                  onMouseLeave={
                    hasDropdown
                      ? () => {
                          setOpenGroup(null)
                        }
                      : undefined
                  }
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) {
                      setOpenGroup(null)
                    }
                  }}
                >
                  {group.hubHref ? (
                    <Link
                      href={group.hubHref}
                      aria-current={active ? 'page' : undefined}
                      aria-haspopup={hasDropdown ? 'true' : undefined}
                      aria-expanded={hasDropdown ? open : undefined}
                      className={triggerClass}
                      onFocus={
                        hasDropdown
                          ? () => {
                              setOpenGroup(group.key)
                            }
                          : undefined
                      }
                      onClick={trackNavClick(group.label)}
                    >
                      {group.label}
                      {hasDropdown && (
                        <ChevronDown
                          className={`h-4 w-4 transition-transform duration-hover ${
                            open ? 'rotate-180' : ''
                          }`}
                          aria-hidden="true"
                        />
                      )}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      aria-haspopup={hasDropdown ? 'true' : undefined}
                      aria-expanded={hasDropdown ? open : undefined}
                      className={triggerClass}
                      onClick={() => {
                        setOpenGroup(open ? null : group.key)
                      }}
                    >
                      {group.label}
                      {hasDropdown && (
                        <ChevronDown
                          className={`h-4 w-4 transition-transform duration-hover ${
                            open ? 'rotate-180' : ''
                          }`}
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  )}

                  {hasDropdown && open && (
                    <div className="absolute left-0 top-full w-64 rounded-card border border-border bg-bgPage py-2xs shadow-card">
                      <ul>
                        {group.items.map((item) => (
                          <li
                            key={item.href}
                            className={
                              item.separated ? 'mt-2xs border-t border-border pt-2xs' : undefined
                            }
                          >
                            <Link
                              href={item.href}
                              aria-current={isActive(pathname, item.href) ? 'page' : undefined}
                              onClick={trackNavClick(item.label)}
                              className="flex items-center gap-xs whitespace-nowrap px-sm py-2xs text-bodySm text-ink transition-colors duration-hover hover:bg-primaryLight hover:text-primary"
                            >
                              {item.icon && (
                                <item.icon className="h-4 w-4 text-primary" aria-hidden="true" />
                              )}
                              {item.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              )
            })}

            <li className="flex h-full items-center">
              <Link
                href="/kiiroksjon"
                aria-current={isActive(pathname, '/kiiroksjon') ? 'page' : undefined}
                onClick={trackNavClick('Kiiroksjonid')}
                className={`relative flex h-full items-center font-heading text-body font-semibold transition-colors duration-hover hover:text-primary ${
                  isActive(pathname, '/kiiroksjon')
                    ? 'text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary'
                    : 'text-ink'
                }`}
              >
                Kiiroksjonid
              </Link>
            </li>
            <li className="flex h-full items-center">
              <Link
                href="/artiklid/uudised"
                aria-current={isActive(pathname, '/artiklid/uudised') ? 'page' : undefined}
                onClick={trackNavClick('Uudised')}
                className={`relative flex h-full items-center font-heading text-body font-semibold transition-colors duration-hover hover:text-primary ${
                  isActive(pathname, '/artiklid/uudised')
                    ? 'text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary'
                    : 'text-ink'
                }`}
              >
                Uudised
              </Link>
            </li>
          </ul>

          <div className="flex items-center gap-md">
            <a
              href={UHISTU_URL}
              target="_blank"
              rel="noopener"
              onClick={trackOutbound('uhistu')}
              className={EXTERNAL_CLASS}
            >
              Metsaühistu
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
            <a
              href={PORTAL_URL}
              target="_blank"
              rel="noopener"
              onClick={trackOutbound('portal')}
              className={CTA_CLASS}
            >
              Oksjonikeskkond
            </a>
          </div>
        </nav>

        <MobileNav
          categories={categories}
          uhistuUrl={UHISTU_URL}
          portalUrl={PORTAL_URL}
          ctaClassName={CTA_CLASS}
        />
      </div>
    </header>
  )
}
