// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ToastProvider } from '../../../../_components/ui/Toast'
import { OpenUserDrawerButton, UserDrawerProvider, type UserDrawerUser } from '../UserDrawer'
import type { UserActionState } from '../tabs/userTabData'
import type { UserTabResult } from '../tabs/userTabQueries'
import type { DataTabId } from '../tabs/userTabs'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

const tabDataMocks = vi.hoisted(() => ({
  loadUserTabData: vi.fn(),
  loadUserActionState: vi.fn(),
}))
vi.mock('../tabs/userTabData', () => tabDataMocks)

const userActionMocks = vi.hoisted(() => ({
  banUserAction: vi.fn(),
  startImpersonationAction: vi.fn(),
  updateUserAction: vi.fn(),
  suspendUserAction: vi.fn(),
  resumeUserAction: vi.fn(),
  revokeUserSessionAction: vi.fn(),
  revealIsikukoodAction: vi.fn(),
  grantAuctionRightAction: vi.fn(),
  revokeAuctionRightAction: vi.fn(),
}))
vi.mock('../../../../_actions/users', () => userActionMocks)

vi.mock('../tabs/GdprTab', () => ({
  GdprTab: (props: { canWrite: boolean }) => (
    <div data-testid="gdpr-tab" data-can-write={String(props.canWrite)} />
  ),
}))

const testUser: UserDrawerUser = {
  id: 'user-9',
  name: 'Mari Mets',
  email: 'mari@example.ee',
  isikukoodMasked: '3270 **** 019',
  role: 'private',
  status: 'active',
}

const writableActive: UserActionState = {
  canWrite: true,
  staffTarget: false,
  banned: false,
  status: 'active',
}

const BAN_OK_MESSAGE = 'Konto keelatud; sama isikukoodiga registreerimine on blokeeritud.'

function identityResult(): UserTabResult {
  return {
    canWrite: true,
    payload: {
      tab: 'identiteet',
      user: {
        id: 'user-9',
        email: 'mari@example.ee',
        name: 'Mari Mets',
        phone: '+37251234567',
        role: 'private',
        status: 'active',
        authMethod: 'eid',
        createdAt: '2026-01-15T09:00:00.000Z',
        isikukoodMasked: '3270 **** 019',
      },
      sessions: [],
      suspension: {
        active: false,
        banned: false,
        duration: null,
        suspendedUntil: null,
        reason: null,
        changedAt: null,
      },
    },
  }
}

function notificationsResult(): UserTabResult {
  return {
    canWrite: true,
    payload: {
      tab: 'teavitused',
      notifications: [
        {
          id: 'notification-1',
          title: 'Uus pakkumisõigus',
          body: 'Administrator andis teile pakkumisõiguse.',
          event: 'user.right_grant',
          channel: 'in_app',
          readAt: null,
          createdAt: '2026-09-01T10:00:00.000Z',
        },
      ],
    },
  }
}

function primeTabData(): void {
  tabDataMocks.loadUserTabData.mockImplementation(
    (_userId: string, tab: DataTabId): Promise<UserTabResult> => {
      if (tab === 'teavitused') return Promise.resolve(notificationsResult())
      return Promise.resolve(identityResult())
    },
  )
}

let container: HTMLDivElement
let root: Root

async function mountDrawer(actionState: UserActionState): Promise<void> {
  tabDataMocks.loadUserActionState.mockResolvedValue(actionState)
  primeTabData()
  await act(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(
      createElement(
        ToastProvider,
        null,
        createElement(
          UserDrawerProvider,
          null,
          createElement(OpenUserDrawerButton, { user: testUser }),
        ),
      ),
    )
    await Promise.resolve()
  })
}

async function unmountDrawer(): Promise<void> {
  await act(async () => {
    root.unmount()
    await Promise.resolve()
  })
  container.remove()
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

async function click(element: HTMLElement): Promise<void> {
  await act(async () => {
    element.click()
    await Promise.resolve()
    await Promise.resolve()
  })
}

async function type(element: HTMLTextAreaElement, text: string): Promise<void> {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(
      element,
      text,
    )
    element.dispatchEvent(new Event('input', { bubbles: true }))
    await Promise.resolve()
  })
}

/** Opens the drawer through the row button and waits for the tab loaders. */
async function openDrawer(): Promise<void> {
  const trigger = container.querySelector('button')
  if (trigger === null) throw new Error('open drawer button not found')
  await click(trigger)
  await flush()
}

function allDialogs(): HTMLElement[] {
  return [...document.body.querySelectorAll<HTMLElement>('[role="dialog"]')]
}

function drawerDialog(): HTMLElement {
  const dialog = allDialogs()[0]
  if (dialog === undefined) throw new Error('drawer dialog not found')
  return dialog
}

function dialogByTitle(title: string): HTMLElement {
  const dialog = allDialogs().find(
    (candidate) => candidate.querySelector('h2')?.textContent === title,
  )
  if (dialog === undefined) throw new Error(`dialog not found: ${title}`)
  return dialog
}

function tabButtons(): HTMLButtonElement[] {
  return [...drawerDialog().querySelectorAll<HTMLButtonElement>('[role="tab"]')]
}

function tabPanel(): HTMLElement {
  const panel = drawerDialog().querySelector<HTMLElement>('[role="tabpanel"]')
  if (panel === null) throw new Error('tabpanel not found')
  return panel
}

function buttonByText(parent: ParentNode, text: string): HTMLButtonElement {
  const button = [...parent.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent === text,
  )
  if (button === undefined) throw new Error(`button not found: ${text}`)
  return button
}

function hasButton(parent: ParentNode, text: string): boolean {
  return [...parent.querySelectorAll<HTMLButtonElement>('button')].some(
    (candidate) => candidate.textContent === text,
  )
}

afterEach(async () => {
  await unmountDrawer()
  vi.clearAllMocks()
})

describe('UserDrawer tabs (720px detail drawer)', () => {
  it('renders all seven tabs with the demo labels and opens on Identiteet', async () => {
    await mountDrawer(writableActive)
    await openDrawer()

    expect(tabButtons().map((tab) => tab.textContent)).toEqual([
      'Identiteet',
      'Profiilid',
      'Õigused',
      'Lepingud',
      'Pakkumised',
      'Teavitused',
      'GDPR',
    ])
    const tablist = drawerDialog().querySelector('[role="tablist"]')
    expect(tablist?.getAttribute('aria-label')).toBe('Kasutaja detailvaate vahelehed')
    expect(tabButtons()[0]?.getAttribute('aria-selected')).toBe('true')
    expect(tabButtons()[1]?.getAttribute('aria-selected')).toBe('false')
    expect(tabPanel().getAttribute('aria-label')).toBe('Identiteet')

    // Drawer header: the user's name as title, the masked isikukood below.
    expect(drawerDialog().querySelector('h2')?.textContent).toBe('Mari Mets')
    expect(drawerDialog().textContent).toContain('3270 **** 019')
  })

  it('loads the active tab through the guarded action and renders its panel', async () => {
    await mountDrawer(writableActive)
    await openDrawer()

    expect(tabDataMocks.loadUserActionState).toHaveBeenCalledWith('user-9')
    expect(tabDataMocks.loadUserTabData).toHaveBeenCalledWith('user-9', 'identiteet')
    expect(tabPanel().textContent).toContain('mari@example.ee')
  })

  it('switches to Teavitused and loads its rows', async () => {
    await mountDrawer(writableActive)
    await openDrawer()

    await click(buttonByText(drawerDialog(), 'Teavitused'))
    await flush()

    expect(buttonByText(drawerDialog(), 'Teavitused').getAttribute('aria-selected')).toBe('true')
    expect(tabPanel().getAttribute('aria-label')).toBe('Teavitused')
    expect(tabDataMocks.loadUserTabData).toHaveBeenCalledWith('user-9', 'teavitused')
    expect(tabPanel().textContent).toContain('Uus pakkumisõigus')
    expect(tabPanel().textContent).toContain('Lugemata')
  })

  it('renders the GDPR tools without loading tab data for the gdpr tab', async () => {
    await mountDrawer(writableActive)
    await openDrawer()

    await click(buttonByText(drawerDialog(), 'GDPR'))
    await flush()

    expect(tabPanel().getAttribute('aria-label')).toBe('GDPR')
    const gdpr = document.body.querySelector('[data-testid="gdpr-tab"]')
    expect(gdpr?.getAttribute('data-can-write')).toBe('true')

    expect(tabDataMocks.loadUserTabData).not.toHaveBeenCalledWith('user-9', 'gdpr')
  })

  it('shows the error box with a retry control when tab loading fails', async () => {
    await mountDrawer(writableActive)
    await openDrawer()
    tabDataMocks.loadUserTabData.mockRejectedValueOnce(new Error('load failed'))

    await click(buttonByText(drawerDialog(), 'Profiilid'))
    await flush()

    const alert = tabPanel().querySelector('[role="alert"]')
    expect(alert?.textContent).toContain('Andmete laadimine ebaõnnestus.')
    expect(hasButton(tabPanel(), 'Proovi uuesti')).toBe(true)
  })
})

describe('UserDrawer footer actions', () => {
  it('offers impersonation and ban for an active portal user', async () => {
    await mountDrawer(writableActive)
    await openDrawer()

    expect(buttonByText(drawerDialog(), 'Vaata kasutajana (Impersonate)').disabled).toBe(false)
    expect(hasButton(drawerDialog(), 'Keela kasutaja (Ban)')).toBe(true)
    expect(drawerDialog().textContent).toContain('Tegevused logitakse auditilogisse.')
  })

  it('hides the ban control for an already banned account', async () => {
    await mountDrawer({ canWrite: true, staffTarget: false, banned: true, status: 'suspended' })
    await openDrawer()

    expect(hasButton(drawerDialog(), 'Keela kasutaja (Ban)')).toBe(false)
    expect(buttonByText(drawerDialog(), 'Vaata kasutajana (Impersonate)').disabled).toBe(true)
  })

  it('offers neither action for a staff target', async () => {
    await mountDrawer({ canWrite: true, staffTarget: true, banned: false, status: 'active' })
    await openDrawer()

    expect(hasButton(drawerDialog(), 'Keela kasutaja (Ban)')).toBe(false)
    expect(buttonByText(drawerDialog(), 'Vaata kasutajana (Impersonate)').disabled).toBe(true)
    expect(drawerDialog().textContent).toContain(
      'Vaatlus ja keelamine ei ole selle konto jaoks saadaval.',
    )
  })

  it('renders no footer without users:write', async () => {
    await mountDrawer({ canWrite: false, staffTarget: false, banned: false, status: 'active' })
    await openDrawer()

    expect(hasButton(drawerDialog(), 'Vaata kasutajana (Impersonate)')).toBe(false)
    expect(hasButton(drawerDialog(), 'Keela kasutaja (Ban)')).toBe(false)
  })
})

describe('UserDrawer ban confirmation', () => {
  it('locks the confirmation until the mandatory reason is long enough', async () => {
    await mountDrawer(writableActive)
    await openDrawer()

    await click(buttonByText(drawerDialog(), 'Keela kasutaja (Ban)'))
    const banDialog = dialogByTitle('Keela kasutaja (Ban)')
    expect(banDialog.textContent).toContain('isikukoodi tasemel')

    const textarea = banDialog.querySelector('textarea')
    if (textarea === null) throw new Error('reason textarea not found')
    await type(textarea, 'ei')
    expect(buttonByText(banDialog, 'Kinnita keelamine').disabled).toBe(true)
    expect(userActionMocks.banUserAction).not.toHaveBeenCalled()

    await type(textarea, 'korduv petturlus')
    expect(buttonByText(banDialog, 'Kinnita keelamine').disabled).toBe(false)
  })

  it('confirms the ban with the reason, toasts the result and reloads the action state', async () => {
    userActionMocks.banUserAction.mockResolvedValue({ ok: true, message: BAN_OK_MESSAGE })
    await mountDrawer(writableActive)
    await openDrawer()

    await click(buttonByText(drawerDialog(), 'Keela kasutaja (Ban)'))
    const banDialog = dialogByTitle('Keela kasutaja (Ban)')
    const textarea = banDialog.querySelector('textarea')
    if (textarea === null) throw new Error('reason textarea not found')
    await type(textarea, 'korduv petturlus')
    await click(buttonByText(banDialog, 'Kinnita keelamine'))
    await flush()

    expect(userActionMocks.banUserAction).toHaveBeenCalledWith('user-9', 'korduv petturlus')
    expect(document.body.textContent).toContain(BAN_OK_MESSAGE)
    expect(allDialogs()).toHaveLength(1)
    expect(tabDataMocks.loadUserActionState).toHaveBeenCalledTimes(2)
  })

  it('surfaces the server rejection toast and keeps the dialog open', async () => {
    userActionMocks.banUserAction.mockResolvedValue({
      ok: false,
      error: 'Kasutaja konto on juba keelatud.',
    })
    await mountDrawer(writableActive)
    await openDrawer()

    await click(buttonByText(drawerDialog(), 'Keela kasutaja (Ban)'))
    const banDialog = dialogByTitle('Keela kasutaja (Ban)')
    const textarea = banDialog.querySelector('textarea')
    if (textarea === null) throw new Error('reason textarea not found')
    await type(textarea, 'korduv petturlus')
    await click(buttonByText(banDialog, 'Kinnita keelamine'))
    await flush()

    expect(document.body.textContent).toContain('Kasutaja konto on juba keelatud.')
    expect(allDialogs()).toHaveLength(2)
    expect(tabDataMocks.loadUserActionState).toHaveBeenCalledTimes(1)
  })
})
