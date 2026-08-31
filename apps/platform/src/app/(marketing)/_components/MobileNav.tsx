'use client'

import { Accordion, Drawer } from '@eametsad/ui'
import { ExternalLink, Menu } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import {
  MEIST_LINKS,
  PARINGUD_LINKS,
  SERVICE_LINKS,
  type HeaderFaqCategory,
  type NavLeafLink,
} from './HeaderDropdown'

import { track } from '@/lib/analytics/track'

// Same rule as the desktop nav: exact match or a child path of href.
function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

interface MobileNavProps {
  categories: HeaderFaqCategory[]
  uhistuUrl: string
  portalUrl: string
  ctaClassName: string
}

export function MobileNav({ categories, uhistuUrl, portalUrl, ctaClassName }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  // Any route change (including back/forward) closes the drawer.
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  const trackNavClick = (item: string) => () => {
    track('nav_click', { item })
  }
  const trackOutbound = (target: 'portal' | 'uhistu') => () => {
    track('outbound_click', { target })
  }

  const renderLinks = (items: NavLeafLink[], onNavigate: () => void) => (
    <ul>
      {items.map((item) => {
        const active = isActive(pathname, item.href)
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? 'page' : undefined}
              onClick={() => {
                onNavigate()
                trackNavClick(item.label)()
              }}
              className={`flex items-center gap-xs px-4 py-2 text-bodySm transition-colors duration-hover hover:text-primary ${
                active ? 'font-semibold text-primary' : 'text-inkMuted'
              }`}
            >
              {item.icon && <item.icon className="h-4 w-4 text-primary" aria-hidden="true" />}
              {item.label}
            </Link>
          </li>
        )
      })}
    </ul>
  )

  const close = () => {
    setIsOpen(false)
  }

  const kkkItems: NavLeafLink[] = [
    { label: 'KKK', href: '/kkk' },
    ...categories.map((category) => ({
      label: category.title,
      href: `/kkk/${category.slug}`,
    })),
  ]

  const accordionItems = [
    {
      id: 'metsa-muuamine',
      title: 'Metsa müümine',
      content: renderLinks(SERVICE_LINKS, close),
    },
    {
      id: 'kkk',
      title: 'KKK',
      content: renderLinks(kkkItems, close),
    },
    {
      id: 'paringud',
      title: 'Päringud',
      content: renderLinks([{ label: 'Päringud', href: '/paringud' }, ...PARINGUD_LINKS], close),
    },
    {
      id: 'meist',
      title: 'Meist',
      content: renderLinks([{ label: 'Meist', href: '/meist' }, ...MEIST_LINKS], close),
    },
  ]

  const plainLinks: NavLeafLink[] = [
    { label: 'Kiiroksjonid', href: '/kiiroksjon' },
    { label: 'Uudised', href: '/artiklid/uudised' },
  ]

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIsOpen(true)
        }}
        aria-label="Ava menüü"
        aria-expanded={isOpen}
        className="flex h-10 w-10 items-center justify-center rounded-button text-ink transition-colors duration-hover hover:bg-primaryLight hover:text-primary md:hidden"
      >
        <Menu className="h-6 w-6" aria-hidden="true" />
      </button>

      {/* Full-screen drawer from the right, groups as accordions, external
          links and CTA pinned to the bottom (design 00 §Mobiil). */}
      <Drawer isOpen={isOpen} onClose={close} title="Menüü" position="right" width="w-full">
        <div className="flex min-h-full flex-col">
          <nav aria-label="Mobiilimenüü">
            <Accordion variant="single" items={accordionItems} className="-mx-4 border-b border-border" />
            <div className="mt-2xs">
              {plainLinks.map((link) => {
                const active = isActive(pathname, link.href)
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => {
                      close()
                      trackNavClick(link.label)()
                    }}
                    className={`block px-4 py-3 font-medium transition-colors duration-hover hover:text-primary ${
                      active ? 'text-primary' : 'text-ink'
                    }`}
                  >
                    {link.label}
                  </Link>
                )
              })}
            </div>
          </nav>

          <div className="sticky bottom-0 -mx-4 -mb-4 mt-auto border-t border-border bg-bgPage px-4 py-3">
            <a
              href={uhistuUrl}
              target="_blank"
              rel="noopener"
              onClick={trackOutbound('uhistu')}
              className="mb-xs flex items-center justify-center gap-1 text-bodySm font-semibold text-ink transition-colors duration-hover hover:text-primary"
            >
              Metsaühistu
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
            <a
              href={portalUrl}
              target="_blank"
              rel="noopener"
              onClick={trackOutbound('portal')}
              className={`${ctaClassName} w-full`}
            >
              Oksjonikeskkond
            </a>
          </div>
        </div>
      </Drawer>
    </>
  )
}
