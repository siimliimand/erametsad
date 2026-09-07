'use client'

import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

import { Drawer } from '../../../_components/ui/Drawer'
import { TabBar } from '../../../_components/ui/TabBar'

export interface UserDrawerUser {
  id: string
  name: string | null
  email: string
  isikukoodMasked: string
}

// Tab set follows the demo (docs/design/demo/admin/06-users.html): the five
// detail page panels plus "Teavitused" and "GDPR". Panel content arrives in
// task 8.2 — every panel renders a placeholder until then.
const DEFAULT_TAB = { id: 'identiteet', label: 'Identiteet' } as const

const TABS = [
  DEFAULT_TAB,
  { id: 'profiilid', label: 'Profiilid' },
  { id: 'oigused', label: 'Õigused' },
  { id: 'lepingud', label: 'Lepingud' },
  { id: 'pakkumised', label: 'Pakkumised' },
  { id: 'teavitused', label: 'Teavitused' },
  { id: 'gdpr', label: 'GDPR' },
] as const

const OpenUserDrawerContext = createContext<((user: UserDrawerUser) => void) | null>(null)

export function UserDrawerProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDrawerUser | null>(null)
  const [activeTabId, setActiveTabId] = useState<string>(DEFAULT_TAB.id)

  const activeTab = TABS.find((tab) => tab.id === activeTabId) ?? DEFAULT_TAB

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
              items={TABS}
              value={activeTab.id}
              onChange={setActiveTabId}
              aria-label="Kasutaja detailvaate vahelehed"
            />
            <div role="tabpanel" aria-label={activeTab.label}>
              <p className="text-bodySm text-inkMuted">Laeb…</p>
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
