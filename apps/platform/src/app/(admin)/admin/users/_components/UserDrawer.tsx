'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { Drawer } from '../../../_components/ui/Drawer'
import { TabBar } from '../../../_components/ui/TabBar'

import { GdprTab } from './tabs/GdprTab'
import { UserTabPanel } from './tabs/UserTabPanel'
import { loadUserTabData } from './tabs/userTabData'
import type { UserTabResult } from './tabs/userTabQueries'
import { DEFAULT_USER_TAB, USER_TABS } from './tabs/userTabs'
import type { DataTabId, UserTabId } from './tabs/userTabs'

export interface UserDrawerUser {
  id: string
  name: string | null
  email: string
  isikukoodMasked: string
}

const DEFAULT_TAB = DEFAULT_USER_TAB

// Tab set follows the demo (docs/design/demo/admin/06-users.html); the panel
// components are the same shared ones the detail page renders.
interface LoadedTab {
  userId: string
  tabId: DataTabId
  result: UserTabResult
}

const errorBoxClass =
  'flex flex-wrap items-center justify-between gap-sm rounded-input border border-danger bg-dangerLight px-md py-sm text-bodySm font-medium text-danger'

const OpenUserDrawerContext = createContext<((user: UserDrawerUser) => void) | null>(null)

export function UserDrawerProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDrawerUser | null>(null)
  const [activeTabId, setActiveTabId] = useState<UserTabId>(DEFAULT_TAB.id)
  const [loaded, setLoaded] = useState<LoadedTab | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const activeTab = USER_TABS.find((tab) => tab.id === activeTabId) ?? DEFAULT_TAB

  useEffect(() => {
    if (user === null || activeTab.id === 'gdpr') {
      setLoaded(null)
      setError(null)
      return
    }
    let cancelled = false
    const tabId = activeTab.id
    setError(null)
    loadUserTabData(user.id, tabId)
      .then((result) => {
        if (!cancelled) setLoaded({ userId: user.id, tabId, result })
      })
      .catch(() => {
        if (!cancelled) setError('Andmete laadimine ebaõnnestus.')
      })
    return () => {
      cancelled = true
    }
  }, [user, activeTab.id, reloadKey])

  return (
    <OpenUserDrawerContext.Provider value={setUser}>
      {children}
      <Drawer
        open={user !== null}
        onClose={() => {
          setUser(null)
        }}
        size="xl"
        title={user ? (user.name ?? user.email) : ''}
        subtitle={user?.isikukoodMasked}
      >
        {user ? (
          <div className="space-y-md">
            <TabBar
              items={USER_TABS}
              value={activeTab.id}
              onChange={(id) => {
                setActiveTabId(id as UserTabId)
              }}
              aria-label="Kasutaja detailvaate vahelehed"
            />
            <div role="tabpanel" aria-label={activeTab.label}>
              {activeTab.id === 'gdpr' ? (
                <GdprTab />
              ) : error ? (
                <div role="alert" className={errorBoxClass}>
                  <span>{error}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setReloadKey((key) => key + 1)
                    }}
                    className="inline-flex h-8 items-center rounded-button border border-danger px-3 text-label font-semibold transition-colors duration-hover ease-hover hover:bg-dangerLight"
                  >
                    Proovi uuesti
                  </button>
                </div>
              ) : loaded && loaded.userId === user.id && loaded.tabId === activeTab.id ? (
                <UserTabPanel payload={loaded.result.payload} canWrite={loaded.result.canWrite} />
              ) : (
                <p className="text-bodySm text-ink-muted">Laeb…</p>
              )}
            </div>
          </div>
        ) : null}
      </Drawer>
    </OpenUserDrawerContext.Provider>
  )
}

export function OpenUserDrawerButton({ user }: { user: UserDrawerUser }) {
  const openUserDrawer = useContext(OpenUserDrawerContext)
  return (
    <button
      type="button"
      onClick={() => {
        openUserDrawer?.(user)
      }}
      title="Ava detailvaade"
      className="inline-flex h-8 items-center rounded-button border border-border bg-bgPage px-3 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:border-primary hover:text-primary"
    >
      Vaata
    </button>
  )
}
