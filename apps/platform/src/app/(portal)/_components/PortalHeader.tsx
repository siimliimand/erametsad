'use client'

import {
  Bell,
  ChevronDown,
  ChevronRight,
  FileText,
  Gavel,
  LogOut,
  type LucideIcon,
  Menu,
  TreePine,
  User,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import { marketingUrl } from '@/app/(marketing)/_lib/base-url'
import { logoutAction } from '@/app/(portal)/_actions/logout'
import type { PortalAuthState } from '@/app/(portal)/_lib/session'
import { apiFetch } from '@/lib/api/client'

interface NavItem {
  label: string
  href: string
  /** Listing tab backed by ?tab=; active only on '/' with that param. */
  tab?: string
  /** Absolute marketing-host target; rendered as a plain anchor. */
  external?: boolean
}

// KKK and Kontakt live on the marketing host (middleware 308s the portal-host
// paths there); marketingUrl keeps the origin in one place.
const navItems: NavItem[] = [
  { label: 'Kõik oksjonid', href: '/' },
  { label: 'Raieõigused', href: '/?tab=raieoigused', tab: 'raieoigused' },
  { label: 'Metskinnistud', href: '/?tab=metskinnistud', tab: 'metskinnistud' },
  { label: 'Ajalugu', href: '/ajalugu' },
  { label: 'KKK', href: marketingUrl('/kkk'), external: true },
  { label: 'Kontakt', href: marketingUrl('/kontakt'), external: true },
]

const sellHref = marketingUrl('/teenused/raieoiguse-muuk')

interface UserMenuItem {
  label: string
  href: string
  icon: LucideIcon
  withUnreadBadge?: boolean
}

// Lepingud stays reachable from the dropdown per design D9.
const userMenuItems: UserMenuItem[] = [
  { label: 'Minu pakkumised', href: '/user/bids', icon: Gavel },
  { label: 'Minu objektid', href: '/user/objects', icon: TreePine },
  {
    label: 'Teavitused',
    href: '/user/notifications',
    icon: Bell,
    withUnreadBadge: true,
  },
  { label: 'Minu profiil', href: '/user/profile', icon: User },
  { label: 'Lepingud', href: '/lepingud', icon: FileText },
]

interface ProfileSummary {
  id: string
  type: 'private' | 'company'
  displayName: string | null
  companyName?: string | null
  approvalStatus?: string | null
}

interface ProfilesResponse {
  profiles?: unknown
}

interface UnreadResponse {
  unreadCount?: unknown
}

interface SwitcherOption {
  id: string
  name: string
  active: boolean
  disabled: boolean
}

function isProfileSummary(value: unknown): value is ProfileSummary {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.id === 'string' &&
    (record.type === 'private' || record.type === 'company') &&
    (typeof record.displayName === 'string' || record.displayName === null)
  )
}

// Mirrors profileDisplayName in (portal)/_lib/session.ts so switcher names
// match the header chip and server components.
function profileOptionName(profile: ProfileSummary): string {
  const isCompany = profile.type === 'company'
  return (
    (isCompany
      ? (profile.companyName ?? profile.displayName)
      : profile.displayName) ?? (isCompany ? 'Ettevõte' : 'Eraisik')
  )
}

// The select endpoint only checks ownership, so the unapproved-company gate
// from the select-profile page is applied client-side here as well.
function toSwitcherOption(
  profile: ProfileSummary,
  activeProfileName: string | null,
): SwitcherOption {
  const name = profileOptionName(profile)
  const selectable =
    profile.type !== 'company' || profile.approvalStatus === 'approved'
  return {
    id: profile.id,
    name,
    active:
      selectable && activeProfileName !== null && name === activeProfileName,
    disabled: !selectable,
  }
}

function avatarInitials(profileName: string | null): string {
  if (profileName === null) return 'K'
  const initials = profileName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
  return initials === '' ? 'K' : initials
}

// Same rule as the user-area Sidebar: exact match, or a child path of href.
function isPathActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

const NAV_TAB_IDS = navItems.flatMap((item) =>
  item.tab !== undefined ? [item.tab] : [],
)

function isNavActive(
  pathname: string,
  tab: string | null,
  item: NavItem,
): boolean {
  if (item.tab !== undefined) return pathname === '/' && tab === item.tab
  if (item.href === '/') {
    // resolveListingTab falls back to the Kõik tab for unknown params.
    return pathname === '/' && (tab === null || !NAV_TAB_IDS.includes(tab))
  }
  return isPathActive(pathname, item.href)
}

const navLinkClass =
  'inline-flex items-center whitespace-nowrap rounded-lg px-3 py-2.5 text-body font-semibold transition-colors duration-hover hover:bg-bgMist hover:text-primary'

const drawerLinkClass =
  'flex items-center justify-between border-b border-border px-2 py-3.5 text-body font-semibold transition-colors duration-hover ease-hover hover:text-primary'

const guestButtonClass =
  'inline-flex min-h-[40px] items-center justify-center whitespace-nowrap rounded-button px-[18px] py-2 text-body font-semibold transition-colors duration-hover ease-hover'

export function PortalHeader({ auth }: { auth: PortalAuthState | null }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const authed = auth !== null

  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [profiles, setProfiles] = useState<ProfileSummary[] | null>(null)
  const [switching, setSwitching] = useState(false)
  const [switchError, setSwitchError] = useState<string | null>(null)

  // Demo shrink: 72px at rest, 60px with a shadow past 8px of scroll.
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

  useEffect(() => {
    document.body.classList.toggle('overflow-hidden', drawerOpen)
    return () => {
      document.body.classList.remove('overflow-hidden')
    }
  }, [drawerOpen])

  useEffect(() => {
    if (!menuOpen && !drawerOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        setDrawerOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen, drawerOpen])

  useEffect(() => {
    if (!authed) return
    let active = true
    apiFetch('/api/v1/my/notifications?unread=1')
      .then((response) =>
        response.ok ? (response.json() as Promise<UnreadResponse>) : null,
      )
      .then((data) => {
        if (active && data !== null && typeof data.unreadCount === 'number') {
          setUnread(data.unreadCount)
        }
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [authed])

  useEffect(() => {
    if (!authed) return
    let active = true
    apiFetch('/api/v1/profiles')
      .then((response) =>
        response.ok ? (response.json() as Promise<ProfilesResponse>) : null,
      )
      .then((data) => {
        if (!active || data === null || !Array.isArray(data.profiles)) return
        const summaries: ProfileSummary[] = []
        for (const entry of data.profiles) {
          if (isProfileSummary(entry)) summaries.push(entry)
        }
        setProfiles(summaries)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [authed])

  // The select endpoint re-issues the access-token cookie in its response, so
  // router.refresh() re-renders the server components (layout, header chip)
  // with the new active profile — same rule as the select-profile page.
  async function handleProfilePick(profileId: string) {
    if (switching) return
    setSwitching(true)
    setSwitchError(null)
    try {
      const response = await apiFetch(`/api/v1/profiles/${profileId}/select`, {
        method: 'POST',
      })
      if (!response.ok) {
        let message = 'Profiili vahetamine ei õnnestunud. Proovi uuesti.'
        try {
          const body = (await response.json()) as { error?: unknown }
          if (typeof body.error === 'string' && body.error !== '')
            message = body.error
        } catch {
          // Keep the fallback copy.
        }
        setSwitchError(message)
        setSwitching(false)
        return
      }
      setMenuOpen(false)
      router.refresh()
    } catch {
      setSwitchError('Võrguühendus ei ole saadaval. Proovi uuesti.')
      setSwitching(false)
    }
  }

  const tab = searchParams.get('tab')
  const switcherOptions =
    profiles?.map((profile) =>
      toSwitcherOption(profile, auth?.profileName ?? null),
    ) ?? null
  const loginHref = `/login?next=${encodeURIComponent(pathname)}`

  const drawerUserBadge = (item: UserMenuItem) =>
    item.withUnreadBadge && unread > 0 ? (
      <span className="flex h-5 min-w-5 items-center justify-center rounded-pill bg-danger px-1 text-[11px] font-bold text-inkInverse">
        {unread > 99 ? '99+' : unread}
      </span>
    ) : null

  return (
    <>
      <header
        className={`sticky top-0 z-[100] border-b border-border bg-bgPage transition-[height,box-shadow] duration-hover ease-hover ${
          scrolled ? 'h-[60px] shadow-card' : 'h-[72px]'
        }`}
      >
        <div className="mx-auto flex h-full w-full max-w-container-xl items-center gap-7 px-md md:px-lg">
          <Link
            href="/"
            aria-label="Erametsad Oksjonid — avaleht"
            className="flex shrink-0 items-center gap-2.5 whitespace-nowrap font-heading text-[22px] font-extrabold tracking-[-0.01em] text-primaryDark"
          >
            <TreePine
              aria-hidden="true"
              className="h-[26px] w-[26px] text-primary"
            />
            Erametsad Oksjonid
          </Link>
          <nav
            aria-label="Peamenüü"
            className="mr-auto hidden items-center gap-1 lg:flex"
          >
            {navItems.map((item) => {
              const active = isNavActive(pathname, tab, item)
              const className = `${navLinkClass} ${
                active ? 'bg-primaryLight text-primary' : 'text-ink'
              }`
              if (item.external === true) {
                return (
                  <a key={item.label} href={item.href} className={className}>
                    {item.label}
                  </a>
                )
              }
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={className}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3.5">
            {auth === null ? (
              <>
                <Link
                  href={loginHref}
                  className={`${guestButtonClass} hidden border border-primary text-primary hover:bg-primaryLight hover:text-primaryHover lg:inline-flex`}
                >
                  Logi sisse
                </Link>
                <a
                  href={sellHref}
                  className={`${guestButtonClass} bg-cta text-ink hover:bg-ctaHover`}
                >
                  Paku oma metsa
                </a>
              </>
            ) : (
              <>
                <a
                  href={sellHref}
                  className={`${guestButtonClass} hidden bg-cta text-ink hover:bg-ctaHover sm:inline-flex`}
                >
                  Paku oma metsa
                </a>
                <div className="relative">
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    onClick={() => {
                      setMenuOpen((open) => !open)
                    }}
                    className="flex items-center gap-2.5 rounded-button p-1.5 text-ink transition-colors duration-hover ease-hover hover:bg-bgMist"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-primary font-heading text-[13px] font-bold tracking-[0.02em] text-inkInverse">
                      {avatarInitials(auth.profileName)}
                    </span>
                    <span className="hidden max-w-40 truncate text-[15px] font-semibold md:inline">
                      {auth.profileName ?? 'Minu konto'}
                    </span>
                    <ChevronDown
                      aria-hidden="true"
                      className={`h-3 w-3 text-inkMuted transition-transform duration-hover ease-hover ${
                        menuOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {menuOpen && (
                    <div
                      role="menu"
                      aria-label="Kasutaja menüü"
                      className="absolute right-0 top-full z-[120] mt-2 w-60 rounded-card border border-border bg-bgPage p-2 shadow-modal"
                    >
                      {userMenuItems.map((item) => {
                        const Icon = item.icon
                        const current = isPathActive(pathname, item.href)
                        return (
                          <Link
                            key={item.href}
                            role="menuitem"
                            href={item.href}
                            aria-current={current ? 'page' : undefined}
                            onClick={() => {
                              setMenuOpen(false)
                            }}
                            className={`flex items-center gap-2.5 rounded-button px-3 py-2.5 text-[15px] font-medium transition-colors duration-hover ease-hover hover:bg-bgMist hover:text-primary ${
                              current
                                ? 'bg-primaryLight font-semibold text-primaryHover'
                                : 'text-ink'
                            }`}
                          >
                            <Icon
                              aria-hidden="true"
                              className="h-[18px] w-[18px] shrink-0 text-inkMuted"
                            />
                            <span className="flex-1">{item.label}</span>
                            {drawerUserBadge(item)}
                          </Link>
                        )
                      })}
                      {switcherOptions !== null &&
                        switcherOptions.length > 0 && (
                          <div className="mt-2 border-t border-border pt-2">
                            <p className="truncate px-3 py-2 text-label font-semibold text-inkMuted">
                              Profiilid
                            </p>
                            <div role="group" aria-label="Profiilid">
                              {switcherOptions.map((option) => (
                                <button
                                  key={option.id}
                                  type="button"
                                  role="menuitemradio"
                                  aria-checked={option.active}
                                  disabled={option.disabled || switching}
                                  onClick={() => {
                                    if (option.active) {
                                      setMenuOpen(false)
                                      return
                                    }
                                    void handleProfilePick(option.id)
                                  }}
                                  className={`block w-full rounded-button px-3 py-2.5 text-left text-[15px] transition-colors duration-hover ease-hover ${
                                    option.disabled
                                      ? 'cursor-not-allowed text-inkMuted opacity-60'
                                      : option.active
                                        ? 'font-semibold text-primary hover:bg-primaryLight'
                                        : 'text-ink hover:bg-primaryLight hover:text-primary'
                                  }`}
                                >
                                  {option.name}
                                  {option.active && (
                                    <span className="sr-only"> (aktiivne)</span>
                                  )}
                                </button>
                              ))}
                            </div>
                            {switchError !== null && (
                              <p
                                role="alert"
                                className="px-3 py-2 text-bodySm text-danger"
                              >
                                {switchError}
                              </p>
                            )}
                          </div>
                        )}
                      <div className="mt-2 border-t border-border pt-2">
                        <form action={logoutAction}>
                          <button
                            type="submit"
                            className="flex w-full items-center gap-2.5 rounded-button px-3 py-2.5 text-left text-[15px] font-medium text-danger transition-colors duration-hover ease-hover hover:bg-dangerLight"
                          >
                            <LogOut
                              aria-hidden="true"
                              className="h-[18px] w-[18px] shrink-0"
                            />
                            Logi välja
                          </button>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
            <button
              type="button"
              aria-expanded={drawerOpen}
              aria-controls="portal-mobile-drawer"
              aria-label={drawerOpen ? 'Sulge menüü' : 'Ava menüü'}
              onClick={() => {
                setDrawerOpen(true)
              }}
              className="p-2 text-ink lg:hidden"
            >
              <Menu aria-hidden="true" className="h-[26px] w-[26px]" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer (demo: right side, 360px, backdrop + Escape close). */}
      {drawerOpen && (
        <div
          aria-hidden="true"
          // Demo backdrop rgba(22,56,42,.4): a raw rgb value, because the
          // Tailwind opacity modifier cannot compose over var()-based colors.
          className="fixed inset-0 z-[140] bg-[rgba(22,56,42,0.4)]"
          onClick={() => {
            setDrawerOpen(false)
          }}
        />
      )}
      <aside
        id="portal-mobile-drawer"
        aria-label="Mobiilmenüü"
        aria-hidden={!drawerOpen}
        inert={!drawerOpen}
        className={`fixed inset-y-0 right-0 z-[150] flex w-[min(360px,92vw)] flex-col bg-bgPage transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          drawerOpen ? 'translate-x-0' : 'invisible translate-x-full'
        }`}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <span className="flex items-center gap-2.5 font-heading text-xl font-extrabold tracking-[-0.01em] text-primaryDark">
            <TreePine
              aria-hidden="true"
              className="h-[22px] w-[22px] text-primary"
            />
            Erametsad Oksjonid
          </span>
          <button
            type="button"
            aria-label="Sulge menüü"
            onClick={() => {
              setDrawerOpen(false)
            }}
            className="p-2 text-ink"
          >
            <X aria-hidden="true" className="h-6 w-6" />
          </button>
        </div>
        <nav aria-label="Mobiilmenüü" className="flex-1 overflow-y-auto p-2">
          {navItems.map((item) => {
            const active = isNavActive(pathname, tab, item)
            const className = `${drawerLinkClass} ${active ? 'text-primary' : 'text-ink'}`
            const children = (
              <>
                {item.label}
                <ChevronRight
                  aria-hidden="true"
                  className="h-3.5 w-3.5 shrink-0 text-inkMuted"
                />
              </>
            )
            if (item.external === true) {
              return (
                <a
                  key={item.label}
                  href={item.href}
                  className={className}
                  onClick={() => {
                    setDrawerOpen(false)
                  }}
                >
                  {children}
                </a>
              )
            }
            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={className}
                onClick={() => {
                  setDrawerOpen(false)
                }}
              >
                {children}
              </Link>
            )
          })}
          {auth !== null && (
            <>
              <p className="px-2 pb-1 pt-4 text-label font-semibold text-inkMuted">
                Minu keskkond
              </p>
              {userMenuItems.map((item) => {
                const Icon = item.icon
                const current = isPathActive(pathname, item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={current ? 'page' : undefined}
                    onClick={() => {
                      setDrawerOpen(false)
                    }}
                    className={`flex items-center justify-between border-b border-border px-2 py-3.5 text-body font-semibold transition-colors duration-hover ease-hover hover:text-primary ${
                      current ? 'text-primary' : 'text-ink'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon
                        aria-hidden="true"
                        className="h-[18px] w-[18px] shrink-0 text-inkMuted"
                      />
                      {item.label}
                    </span>
                    {drawerUserBadge(item)}
                  </Link>
                )
              })}
            </>
          )}
        </nav>
        <div className="grid shrink-0 gap-2.5 border-t border-border p-4">
          <a
            href={sellHref}
            className={`${guestButtonClass} bg-cta text-ink hover:bg-ctaHover`}
          >
            Paku oma metsa
          </a>
          {auth === null ? (
            <Link
              href={loginHref}
              className={`${guestButtonClass} border border-primary text-primary hover:bg-primaryLight hover:text-primaryHover`}
            >
              Logi sisse
            </Link>
          ) : (
            <form action={logoutAction}>
              <button
                type="submit"
                className={`${guestButtonClass} w-full border border-danger text-danger hover:bg-dangerLight`}
              >
                Logi välja
              </button>
            </form>
          )}
        </div>
      </aside>
    </>
  )
}
