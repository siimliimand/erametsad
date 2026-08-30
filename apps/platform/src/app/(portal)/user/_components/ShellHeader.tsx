'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, type SVGProps } from 'react'

import { logoutAction } from '@/app/(portal)/_actions/logout'
import { useMyStream } from '@/app/(portal)/_lib/use-my-stream'

// Inline Lucide-geometry icons (ISC); apps/platform does not declare
// lucide-react as a direct dependency, so the few icons the shell needs are
// vendored. Keep in sync with lucide-react when the dependency lands.
function Svg({ children, ...props }: SVGProps<SVGSVGElement>) {
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

function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg className="h-4 w-4 shrink-0" {...props}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </Svg>
  )
}

function BellIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg className="h-4 w-4 shrink-0" {...props}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </Svg>
  )
}

function ChevronRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg className="h-3 w-3 shrink-0" {...props}>
      <path d="m9 18 6-6-6-6" />
    </Svg>
  )
}

// GET /api/v1/my/notifications?unread=1 contract (task 1.8).
interface NotificationsResponse {
  items: unknown[]
  nextCursor: string | null
  unreadCount: number
}

// GET /api/v1/profiles contract: { profiles: toPublicProfile(...) } — the
// fields the switcher needs from the public profile shape.
export interface ProfileSummary {
  id: string
  type: 'private' | 'company'
  displayName: string | null
  companyName?: string | null
  approvalStatus?: string | null
}

interface ProfilesResponse {
  profiles: ProfileSummary[]
}

export interface ProfileSwitcherOption {
  id: string
  name: string
  active: boolean
  disabled: boolean
}

// Mirrors profileDisplayName in (portal)/_lib/session.ts so the dropdown
// names match what the header chip and server components show.
function profileOptionName(profile: ProfileSummary): string {
  const isCompany = profile.type === 'company'
  return (
    (isCompany ? (profile.companyName ?? profile.displayName) : profile.displayName) ??
    (isCompany ? 'Ettevõte' : 'Eraisik')
  )
}

// The select endpoint only checks ownership, so the unapproved-company gate
// from the select-profile page is applied client-side here as well.
export function toSwitcherOption(
  profile: ProfileSummary,
  activeProfileName: string | null,
): ProfileSwitcherOption {
  const name = profileOptionName(profile)
  const selectable = profile.type !== 'company' || profile.approvalStatus === 'approved'
  return {
    id: profile.id,
    name,
    active: selectable && activeProfileName !== null && name === activeProfileName,
    disabled: !selectable,
  }
}

const profileMenuItems = [
  { label: 'Minu pakkumised', href: '/user/bids' },
  { label: 'Minu müügid', href: '/user/objects' },
  { label: 'Minu profiil', href: '/user/profile' },
  { label: 'Lepingud', href: '/lepingud' },
]

const crumbLabels: Record<string, string> = {
  bids: 'Pakkumised',
  objects: 'Müügid',
  notifications: 'Teavitused',
  profile: 'Profiil',
}

function ShellBreadcrumbs() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean).slice(1)
  const crumbs: { label: string; href: string }[] = [
    { label: 'Minu keskkond', href: '/user' },
  ]
  let acc = '/user'
  for (const segment of segments) {
    acc += `/${segment}`
    crumbs.push({ label: crumbLabels[segment] ?? segment, href: acc })
  }
  return (
    <nav aria-label="Toimelõng" className="overflow-x-auto">
      <ol className="flex items-center gap-xs whitespace-nowrap">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1
          return (
            <li key={crumb.href} className="flex items-center gap-xs">
              {index > 0 && <ChevronRightIcon className="text-inkMuted" />}
              {isLast ? (
                <span aria-current="page" className="text-label font-semibold text-ink">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-label text-inkMuted transition-colors duration-hover hover:text-primary"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export function ShellHeader({ profileName }: { profileName: string | null }) {
  const router = useRouter()
  const { subscribe } = useMyStream()
  const [unread, setUnread] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [profiles, setProfiles] = useState<ProfileSummary[] | null>(null)
  const [switching, setSwitching] = useState(false)
  const [switchError, setSwitchError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetch('/api/v1/my/notifications?unread=1')
      .then((response) => (response.ok ? (response.json() as Promise<NotificationsResponse>) : null))
      .then((data) => {
        if (active && data && typeof data.unreadCount === 'number') {
          setUnread(data.unreadCount)
        }
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    fetch('/api/v1/profiles')
      .then((response) => (response.ok ? (response.json() as Promise<ProfilesResponse>) : null))
      .then((data) => {
        if (!active || !data || !Array.isArray(data.profiles)) return
        const valid = data.profiles.filter(
          (profile) =>
            typeof profile?.id === 'string' &&
            (profile.type === 'private' || profile.type === 'company'),
        )
        setProfiles(valid)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  useEffect(
    () =>
      subscribe('notification', () => {
        setUnread((count) => count + 1)
      }),
    [subscribe],
  )

  const switcherOptions = profiles?.map((profile) => toSwitcherOption(profile, profileName)) ?? null

  // The select endpoint re-issues the access-token cookie in its response, so
  // router.refresh() re-renders the server components (layout, header chip)
  // with the new active profile — same rule as the select-profile page's
  // full navigation.
  async function handleProfilePick(profileId: string) {
    if (switching) return
    setSwitching(true)
    setSwitchError(null)
    try {
      const response = await fetch(`/api/v1/profiles/${profileId}/select`, {
        method: 'POST',
      })
      if (!response.ok) {
        let message = 'Profiili vahetamine ei õnnestunud. Proovi uuesti.'
        try {
          const body = (await response.json()) as { error?: unknown }
          if (typeof body.error === 'string' && body.error !== '') message = body.error
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

  return (
    <header className="rounded-card border border-border bg-bgPage shadow-card">
      <div className="flex items-center gap-md px-md py-sm">
        <Link href="/" className="flex flex-col leading-tight">
          <span className="font-heading text-h4 font-extrabold text-primaryDark">Eametsad</span>
          <span className="text-label text-inkMuted">Oksjonid</span>
        </Link>
        <form
          action="/"
          role="search"
          className="ml-md hidden w-full max-w-sm items-center gap-xs rounded-input border border-border bg-bgMist px-sm py-2xs focus-within:border-primary sm:flex"
        >
          <SearchIcon className="text-inkMuted" />
          <input
            type="search"
            name="q"
            placeholder="Otsi oksjoneid…"
            aria-label="Otsi oksjoneid"
            className="w-full bg-transparent text-bodySm text-ink outline-none placeholder:text-inkMuted"
          />
        </form>
        <div className="ml-auto flex items-center gap-sm">
          <Link
            href="/user/notifications"
            aria-label={unread > 0 ? `Teavitused, ${String(unread)} lugemata` : 'Teavitused'}
            className="relative flex h-9 w-9 items-center justify-center rounded-pill border border-border text-ink transition-colors duration-hover hover:border-primary hover:text-primary"
          >
            <BellIcon />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-pill bg-danger px-1 text-[11px] font-bold text-inkInverse">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </Link>
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
                {(profileName ?? 'K').charAt(0).toUpperCase()}
              </span>
              <span className="hidden max-w-32 truncate md:inline">
                {profileName ?? 'Minu konto'}
              </span>
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-20 mt-2xs w-56 rounded-card border border-border bg-bgPage py-2xs shadow-modal"
              >
                <p className="truncate px-sm py-xs text-label font-semibold text-inkMuted">
                  {profileName ?? 'Minu konto'}
                </p>
                {profileMenuItems.map((item) => (
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
                {switcherOptions !== null && switcherOptions.length > 0 && (
                  <div className="mt-2xs border-t border-border pt-2xs">
                    <p className="truncate px-sm py-2xs text-label font-semibold text-inkMuted">
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
                          className={`block w-full px-sm py-xs text-left text-bodySm transition-colors duration-hover ${
                            option.disabled
                              ? 'cursor-not-allowed text-inkMuted opacity-60'
                              : option.active
                                ? 'font-semibold text-primary hover:bg-primaryLight'
                                : 'text-ink hover:bg-primaryLight hover:text-primary'
                          }`}
                        >
                          {option.name}
                          {option.active && <span className="sr-only"> (aktiivne)</span>}
                        </button>
                      ))}
                    </div>
                    {switchError !== null && (
                      <p role="alert" className="px-sm py-2xs text-bodySm text-danger">
                        {switchError}
                      </p>
                    )}
                  </div>
                )}
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
        </div>
      </div>
      <div className="border-t border-border px-md py-2xs">
        <ShellBreadcrumbs />
      </div>
    </header>
  )
}
