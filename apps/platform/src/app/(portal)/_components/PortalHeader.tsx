'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

import { logoutAction } from '@/app/(portal)/_actions/logout'
import type { PortalAuthState } from '@/app/(portal)/_lib/session'

const marketingLinks = [
  { label: 'Metsa müümine', href: 'https://erametsad.ee' },
  { label: 'Raieõiguse müümine', href: 'https://erametsad.ee' },
  { label: 'Kinnistu müük', href: 'https://erametsad.ee' },
  { label: 'Päringud', href: 'https://erametsad.ee' },
  { label: 'Hindamisaktid', href: 'https://erametsad.ee' },
  { label: 'Metsateatis', href: 'https://erametsad.ee' },
  { label: 'Metsaspetsialistid', href: 'https://erametsad.ee' },
]

const portalLinks = [
  { label: 'Ajalugu', href: '/ajalugu' },
  { label: 'Registreeru', href: '/register' },
]

const userMenuItems = [
  { label: 'Minu pakkumised', href: '/user/bids' },
  { label: 'Minu müügid', href: '/user/objects' },
  { label: 'Minu profiil', href: '/user/profile' },
  { label: 'Teavitused', href: '/user/notifications' },
]

// Same rule as the user-area Sidebar: exact match, or a child path of href.
function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function PortalHeader({ auth }: { auth: PortalAuthState | null }) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  const loginHref = `/login?next=${encodeURIComponent(pathname)}`

  return (
    <header className="border-b border-border bg-bgPage">
      <div className="mx-auto w-full max-w-container-xl px-md md:px-lg">
        <div className="flex items-center gap-md py-sm">
          <Link href="/" className="flex flex-col leading-tight">
            <span className="font-heading text-h4 font-extrabold text-primaryDark">Erametsad</span>
            <span className="text-label text-inkMuted">Oksjonid</span>
          </Link>
          <nav
            aria-label="Peamenüü"
            className="hidden flex-1 items-center gap-md text-bodySm lg:flex"
          >
            {marketingLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="whitespace-nowrap text-ink transition-colors duration-hover hover:text-primary"
              >
                {link.label}
              </a>
            ))}
            {portalLinks.map((link) => {
              const active = isActive(pathname, link.href)
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={`whitespace-nowrap transition-colors duration-hover hover:text-primary ${
                    active ? 'text-primary' : 'text-ink'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>
          <div className="ml-auto flex items-center">
            {auth ? (
              <div className="relative">
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  onClick={() => {
                    setMenuOpen((open) => !open)
                  }}
                  className="flex items-center gap-xs rounded-pill border border-border bg-bgPage px-sm py-2xs text-bodySm font-semibold text-ink transition-colors duration-hover hover:border-primary hover:text-primary"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-pill bg-primary text-label text-inkInverse">
                    {(auth.profileName ?? 'K').charAt(0).toUpperCase()}
                  </span>
                  <span className="max-w-32 truncate">{auth.profileName ?? 'Minu konto'}</span>
                </button>
                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-10 mt-2xs w-56 rounded-card border border-border bg-bgPage py-2xs shadow-card"
                  >
                    {userMenuItems.map((item) => (
                      <Link
                        key={item.href}
                        role="menuitem"
                        href={item.href}
                        onClick={() => {
                          setMenuOpen(false)
                        }}
                        className="block px-sm py-xs text-bodySm text-ink transition-colors duration-hover hover:bg-primaryLight hover:text-primary"
                      >
                        {item.label}
                      </Link>
                    ))}
                    <div className="mt-2xs border-t border-border pt-2xs">
                      <form action={logoutAction}>
                        <button
                          type="submit"
                          className="block w-full px-sm py-xs text-left text-bodySm text-danger transition-colors duration-hover hover:bg-dangerLight"
                        >
                          Logi välja
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href={loginHref}
                className="rounded-button bg-primary px-sm py-2xs text-bodySm font-semibold text-inkInverse transition-colors duration-hover hover:bg-primaryHover"
              >
                Logi sisse
              </Link>
            )}
          </div>
        </div>
        <nav
          aria-label="Peamenüü"
          className="flex gap-md overflow-x-auto pb-sm text-bodySm lg:hidden"
        >
          {marketingLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="whitespace-nowrap text-ink transition-colors duration-hover hover:text-primary"
            >
              {link.label}
            </a>
          ))}
          {portalLinks.map((link) => {
            const active = isActive(pathname, link.href)
            return (
              <Link
                key={link.label}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`whitespace-nowrap transition-colors duration-hover hover:text-primary ${
                  active ? 'text-primary' : 'text-ink'
                }`}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
