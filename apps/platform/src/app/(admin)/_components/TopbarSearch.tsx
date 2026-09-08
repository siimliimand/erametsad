'use client'

/**
 * Topbar search trigger plus the Cmd/Ctrl+K route-jump palette. The
 * trigger replicates the demo topbar-search field; the palette groups
 * module routes (labels mirror ADMIN_MODULES) and filters them as the
 * operator types. SSR stays static: listeners attach inside effects and
 * the palette itself only renders through the client OverlayPortal.
 */

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'

import { SearchIcon } from './icons'
import { OverlayPortal } from './ui/OverlayPortal'
import { trapTabKey, useDialogFocus, useEscapeKey } from './ui/useOverlay'

interface PaletteRoute {
  label: string
  href: string
}

interface PaletteGroup {
  id: string
  label: string
  routes: readonly PaletteRoute[]
}

// Static route map so palette hrefs stay in sync with the module registry
// and existing page routes; labels are the ADMIN_MODULES strings.
const PALETTE_GROUPS: readonly PaletteGroup[] = [
  {
    id: 'auctions',
    label: 'Oksjonid',
    routes: [
      { label: 'Oksjonid', href: '/admin/auctions' },
      { label: 'Uus oksjon', href: '/admin/auctions/new' },
    ],
  },
  {
    id: 'users',
    label: 'Kasutajad',
    routes: [{ label: 'Kasutajad', href: '/admin/users' }],
  },
  {
    id: 'leads',
    label: 'Juhtlõimed',
    routes: [{ label: 'Juhtlõimed', href: '/admin/leads' }],
  },
  {
    id: 'contracts',
    label: 'Lepingud',
    routes: [
      { label: 'Lepingud', href: '/admin/contracts' },
      { label: 'Lepingu mallid', href: '/admin/contracts/templates' },
    ],
  },
  {
    id: 'settings',
    label: 'Seaded',
    routes: [{ label: 'Seaded', href: '/admin/settings' }],
  },
]

const kbdClass =
  'rounded-[6px] border border-border bg-bgPage px-1.5 font-mono text-[11px] leading-4 font-medium text-inkMuted'

function filterGroups(query: string): readonly PaletteGroup[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return PALETTE_GROUPS
  return PALETTE_GROUPS.flatMap((group) => {
    const groupMatch = group.label.toLowerCase().includes(needle)
    const routes = group.routes.filter(
      (route) =>
        groupMatch ||
        route.label.toLowerCase().includes(needle) ||
        route.href.toLowerCase().includes(needle),
    )
    return routes.length > 0 ? [{ ...group, routes }] : []
  })
}

export function TopbarSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)

  const groups = useMemo(() => filterGroups(query), [query])
  const items = useMemo(() => groups.flatMap((group) => group.routes), [groups])
  // Flat position per route so one activeIndex spans all group boundaries.
  const rows = useMemo(() => {
    let flatIndex = 0
    return groups.map((group) => ({
      ...group,
      routes: group.routes.map((route) => ({ ...route, flatIndex: flatIndex++ })),
    }))
  }, [groups])
  const activeIndexSafe = items.length > 0 ? Math.min(activeIndex, items.length - 1) : -1
  const activeItem = activeIndexSafe >= 0 ? items[activeIndexSafe] : null

  function close() {
    setOpen(false)
  }

  useEscapeKey(open, close)
  useDialogFocus(open, panelRef)

  // Unlike the ⌘N shortcut, ⌘K toggles from editable fields too: the
  // palette is a non-destructive overlay and standard palette behavior
  // expects it to open while the operator is typing elsewhere.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return
      event.preventDefault()
      setOpen((value) => !value)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  function navigate(href: string) {
    setOpen(false)
    router.push(href)
  }

  // Fresh palette on every open: cleared query, first item highlighted.
  useEffect(() => {
    if (!open) return
    setQuery('')
    setActiveIndex(0)
  }, [open])

  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (items.length === 0) return
      const delta = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((index) => (index + delta + items.length) % items.length)
      return
    }
    if (event.key === 'Enter' && activeItem) {
      event.preventDefault()
      navigate(activeItem.href)
    }
  }

  function handlePanelKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (panelRef.current) trapTabKey(event, panelRef.current)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true)
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Globaalne otsing"
        aria-keyshortcuts="Meta+K Control+K"
        className="relative mx-auto flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[8px] border border-transparent bg-bgMist text-left transition-colors duration-hover ease-hover hover:border-primary hover:bg-bgPage md:w-full md:max-w-[420px] md:justify-start md:px-2.5"
      >
        <SearchIcon className="h-4 w-4 shrink-0 text-inkMuted" />
        <span className="hidden min-w-0 flex-1 truncate text-[13px] leading-[18px] text-inkMuted md:block">
          Otsi...
        </span>
        <kbd aria-hidden="true" className={`${kbdClass} hidden md:inline`}>
          ⌘K
        </kbd>
      </button>

      {open && (
        <OverlayPortal>
          {/* Backdrop: click-to-close guard checks the target so clicks inside
              the panel that bubble up do not close it. */}
          <div
            className="fixed inset-0 z-[var(--z-modal)] flex items-start justify-center bg-[var(--overlay)] px-4 pt-[10vh]"
            onClick={(event) => {
              if (event.target === event.currentTarget) close()
            }}
          >
            <div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label="Globaalne otsing"
              tabIndex={-1}
              onKeyDown={handlePanelKeyDown}
              className="animate-[modal-in_0.18s_ease-out] motion-reduce:animate-none w-full max-w-[560px] overflow-hidden rounded-card border border-border bg-bgPage shadow-modal"
            >
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <SearchIcon className="h-4 w-4 shrink-0 text-inkMuted" />
                <input
                  type="text"
                  role="combobox"
                  aria-expanded="true"
                  aria-controls="topbar-search-results"
                  aria-activedescendant={
                    activeIndexSafe >= 0
                      ? `topbar-search-option-${String(activeIndexSafe)}`
                      : undefined
                  }
                  aria-label="Otsi lehekülgi"
                  autoComplete="off"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setActiveIndex(0)
                  }}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Otsi..."
                  className="min-w-0 flex-1 border-0 bg-transparent text-[13px] leading-[18px] text-ink outline-none placeholder:text-inkMuted"
                />
                <kbd aria-hidden="true" className={kbdClass}>
                  Esc
                </kbd>
              </div>
              <div
                id="topbar-search-results"
                role="listbox"
                aria-label="Otsingu tulemused"
                className="max-h-[50vh] overflow-y-auto py-1"
              >
                {rows.length === 0 ? (
                  <p className="px-4 py-6 text-center text-bodySm text-inkMuted">
                    Tulemusi ei leitud
                  </p>
                ) : (
                  rows.map((group) => (
                    <div key={group.id} role="group" aria-label={group.label}>
                      <p className="px-4 pb-1 pt-3 text-label font-semibold uppercase tracking-[0.04em] text-inkMuted">
                        {group.label}
                      </p>
                      {group.routes.map((route) => (
                        <button
                          key={route.href}
                          id={`topbar-search-option-${String(route.flatIndex)}`}
                          type="button"
                          role="option"
                          aria-selected={route.flatIndex === activeIndexSafe}
                          onClick={() => {
                            navigate(route.href)
                          }}
                          onMouseMove={() => {
                            setActiveIndex(route.flatIndex)
                          }}
                          className={`flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-bodySm transition-colors duration-hover ease-hover ${
                            route.flatIndex === activeIndexSafe ? 'bg-bgMist text-primary' : 'text-ink'
                          }`}
                        >
                          <span className="min-w-0 truncate">{route.label}</span>
                          <span className="shrink-0 font-mono text-[11px] text-inkMuted">
                            {route.href}
                          </span>
                        </button>
                      ))}
                    </div>
                  ))
                )}
              </div>
              <div className="flex items-center gap-3 border-t border-border bg-bgMist px-4 py-2 text-label text-inkMuted">
                <span className="flex items-center gap-1">
                  <kbd aria-hidden="true" className={kbdClass}>↑</kbd>
                  <kbd aria-hidden="true" className={kbdClass}>↓</kbd>
                  Liigu
                </span>
                <span className="flex items-center gap-1">
                  <kbd aria-hidden="true" className={kbdClass}>↵</kbd>
                  Ava
                </span>
                <span className="flex items-center gap-1">
                  <kbd aria-hidden="true" className={kbdClass}>Esc</kbd>
                  Sulge
                </span>
              </div>
            </div>
          </div>
        </OverlayPortal>
      )}
    </>
  )
}
