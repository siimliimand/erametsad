'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'


import { GdprTab } from './tabs/GdprTab'
import { UserTabPanel } from './tabs/UserTabPanel'
import { loadUserActionState, loadUserTabData } from './tabs/userTabData'
import type { UserActionState } from './tabs/userTabData'
import type { UserTabResult } from './tabs/userTabQueries'
import { DEFAULT_USER_TAB, USER_TABS } from './tabs/userTabs'
import type { DataTabId, UserTabId } from './tabs/userTabs'
import {
  banUserAction,
  startImpersonationAction,
} from '../../../_actions/users'
import { ConfirmDialog } from '../../../_components/ui/ConfirmDialog'
import { Drawer } from '../../../_components/ui/Drawer'
import { TabBar } from '../../../_components/ui/TabBar'
import { useToast } from '../../../_components/ui/Toast'

export interface UserDrawerUser {
  id: string
  name: string | null
  email: string
  isikukoodMasked: string
  role: string
  status: string
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

// Demo 06-users "Critical actions" footer: ghost impersonate, danger ban.
const footerGhostButtonClass =
  'inline-flex h-9 items-center gap-1.5 rounded-button border border-border bg-bgPage px-3.5 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50'
const footerDangerButtonClass =
  'inline-flex h-9 items-center gap-1.5 rounded-button bg-danger px-3.5 text-label font-semibold text-inkInverse transition-[filter] duration-hover ease-hover hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-50'

function isRedirectSignal(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest
  return (
    typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT')
  )
}

const OpenUserDrawerContext = createContext<((user: UserDrawerUser) => void) | null>(null)

export function UserDrawerProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDrawerUser | null>(null)
  const [activeTabId, setActiveTabId] = useState<UserTabId>(DEFAULT_TAB.id)
  const [loaded, setLoaded] = useState<LoadedTab | null>(null)
  const [actionState, setActionState] = useState<UserActionState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [impersonateOpen, setImpersonateOpen] = useState(false)
  const [impersonateBusy, setImpersonateBusy] = useState(false)
  const [banOpen, setBanOpen] = useState(false)
  const [banBusy, setBanBusy] = useState(false)

  const pushToast = useToast()

  const activeTab = USER_TABS.find((tab) => tab.id === activeTabId) ?? DEFAULT_TAB

  useEffect(() => {
    if (user === null) {
      setLoaded(null)
      setActionState(null)
      setError(null)
      return
    }
    if (activeTab.id === 'gdpr') {
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

  useEffect(() => {
    if (user === null) return
    let cancelled = false
    loadUserActionState(user.id)
      .then((state) => {
        if (!cancelled) setActionState(state)
      })
      .catch(() => {
        if (!cancelled) setActionState(null)
      })
    return () => {
      cancelled = true
    }
  }, [user, reloadKey])

  const canWrite = actionState?.canWrite ?? false
  const impersonatable =
    canWrite && actionState !== null && !actionState.staffTarget && actionState.status === 'active'
  const bannable = canWrite && actionState !== null && !actionState.staffTarget && !actionState.banned

  const startImpersonation = (reason: string) => {
    if (!user) return
    setImpersonateBusy(true)
    const formData = new FormData()
    formData.set('userId', user.id)
    formData.set('reason', reason)
    startImpersonationAction(formData)
      .then(() => {
        // Success never reaches here: the action redirects into the portal.
      })
      .catch((caught: unknown) => {
        if (!isRedirectSignal(caught)) {
          pushToast({ title: 'Vaatluse alustamine ebaõnnestus.', tone: 'error' })
          setImpersonateBusy(false)
        }
      })
  }

  const banUser = (reason: string) => {
    if (!user) return
    setBanBusy(true)
    banUserAction(user.id, reason)
      .then((result) => {
        setBanBusy(false)
        if (result.ok) {
          setBanOpen(false)
          pushToast({ title: result.message, tone: 'success' })
          setReloadKey((key) => key + 1)
        } else {
          pushToast({ title: result.error, tone: 'error' })
        }
      })
      .catch(() => {
        setBanBusy(false)
        pushToast({ title: 'Kasutaja keelamine ebaõnnestus.', tone: 'error' })
      })
  }

  return (
    <OpenUserDrawerContext.Provider value={setUser}>
      {children}
      <Drawer
        open={user !== null}
        onClose={() => {
          setUser(null)
          setImpersonateOpen(false)
          setBanOpen(false)
        }}
        size="xl"
        title={user ? (user.name ?? user.email) : ''}
        subtitle={user?.isikukoodMasked}
        footer={
          user && canWrite ? (
            <div className="flex w-full flex-wrap items-center gap-2">
              <span className="mr-auto text-label text-inkMuted">
                {impersonatable || bannable
                  ? 'Tegevused logitakse auditilogisse.'
                  : 'Vaatlus ja keelamine ei ole selle konto jaoks saadaval.'}
              </span>
              <button
                type="button"
                disabled={!impersonatable}
                onClick={() => {
                  setImpersonateOpen(true)
                }}
                className={footerGhostButtonClass}
              >
                Vaata kasutajana (Impersonate)
              </button>
              {bannable ? (
                <button
                  type="button"
                  onClick={() => {
                    setBanOpen(true)
                  }}
                  className={footerDangerButtonClass}
                >
                  Keela kasutaja (Ban)
                </button>
              ) : null}
            </div>
          ) : null
        }
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
                <GdprTab
                  userId={user.id}
                  canWrite={canWrite}
                  onChanged={() => {
                    setReloadKey((key) => key + 1)
                  }}
                />
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
              ) : loaded?.userId === user.id && loaded.tabId === activeTab.id ? (
                <UserTabPanel payload={loaded.result.payload} canWrite={loaded.result.canWrite} />
              ) : (
                <p className="text-bodySm text-ink-muted">Laeb…</p>
              )}
            </div>
          </div>
        ) : null}
      </Drawer>

      {user ? (
        <>
          {/* Demo 06-users impModal: amber warning, mandatory reason (min 5). */}
          <ConfirmDialog
            open={impersonateOpen}
            onClose={() => {
              setImpersonateOpen(false)
            }}
            title="Vaata kasutajana (Impersonate)"
            description="Vaatluse ajal kasutad portaali kasutaja nimel. Kirjutustegevused (pakkumine, allkirjastamine) on blokeeritud ja kogu tegevus logitakse auditilogisse."
            variant="reason"
            reasonLabel="Põhjus (kohustuslik)"
            reasonPlaceholder="nt kliendi jäävat probleemi uurimine"
            confirmLabel="Alusta vaatlust"
            busy={impersonateBusy}
            onConfirm={startImpersonation}
          />
          <ConfirmDialog
            open={banOpen}
            onClose={() => {
              setBanOpen(false)
            }}
            title="Keela kasutaja (Ban)"
            description="Keelamine on pöördumatu ja kehtib isikukoodi tasemel — kasutaja ei saa sama isikukoodiga enam kontot luua."
            variant="reason"
            reasonLabel="Põhjus (kohustuslik)"
            reasonPlaceholder="nt korduv petturlus — shill-pakkumised"
            confirmLabel="Kinnita keelamine"
            busy={banBusy}
            onConfirm={banUser}
          />
        </>
      ) : null}
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
