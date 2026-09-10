// @vitest-environment jsdom
import { act, createElement, type ReactElement, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: (props: { href: string; className?: string; children: ReactNode }) =>
    createElement(
      'a',
      { href: props.href, className: props.className },
      props.children,
    ),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))

import { DataCard } from '../DataCard'
import { DeleteAccountModal } from '../DeleteAccountModal'
import { ProfilesCard } from '../ProfilesCard'
import { maskIsikukood } from '../format'
import type { ProfileView, UserAccount } from '../types'

const ACCOUNT: UserAccount = {
  isikukood: '38705160217',
  eidVerified: true,
  authMethod: 'eid',
  name: 'Tõnis Kask',
  email: 'tonis@tamm.ee',
}

const PRIVATE: ProfileView = {
  id: 'p1',
  type: 'private',
  displayName: 'Tõnis Kask',
  phone: '+372 5123 4567',
  approvalStatus: 'approved',
  termsConsentAt: null,
  privacyConsentAt: null,
  marketingConsentAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  companyName: null,
  companyRegCode: null,
}

const COMPANY: ProfileView = {
  ...PRIVATE,
  id: 'p2',
  type: 'company',
  displayName: null,
  approvalStatus: 'approved',
  companyName: 'Tamm OÜ',
  companyRegCode: '14309277',
}

;(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement | null = null
let root: Root | null = null

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  // The shared Modal focuses via requestAnimationFrame; jsdom may lack it.
  vi.stubGlobal('requestAnimationFrame', (cb: (time: number) => void) =>
    setTimeout(() => {
      cb(0)
    }, 0),
  )
})

afterEach(() => {
  if (root !== null) {
    act(() => {
      root?.unmount()
    })
    root = null
  }
  container?.remove()
  container = null
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

function node(): HTMLElement {
  if (container === null) throw new Error('container missing')
  return container
}

async function mount(element: ReactElement): Promise<void> {
  const el = node()
  await act(async () => {
    root = createRoot(el)
    root.render(element)
    await Promise.resolve()
  })
}

function clickButton(root: HTMLElement, label: string): void {
  const button = Array.from(root.querySelectorAll('button')).find((item) =>
    item.textContent.includes(label),
  )
  if (!button) throw new Error(`button not found: ${label}`)
  button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

function textOf(scope: HTMLElement | null): string {
  return scope?.textContent ?? ''
}

describe('maskIsikukood', () => {
  it('keeps the first 7 characters with the fixed 5-star tail', () => {
    expect(maskIsikukood('38705160217')).toBe('3870516*****')
  })

  it('stars short values entirely', () => {
    expect(maskIsikukood('3870516')).toBe('*****')
  })
})

describe('DataCard isikukood masking', () => {
  it('renders the masked code by default and never the full value', async () => {
    await mount(
      createElement(DataCard, {
        account: ACCOUNT,
        profile: PRIVATE,
        onSaved: vi.fn(),
      }),
    )
    expect(node().textContent).toContain('3870516*****')
    expect(node().textContent).not.toContain('38705160217')
    expect(node().textContent).toContain('Vaatamine logitakse auditisse')
    expect(node().textContent).toContain('kinnitatud eID-iga')
  })

  it('reveals the full value with Näita and flips the audit note', async () => {
    await mount(
      createElement(DataCard, {
        account: ACCOUNT,
        profile: PRIVATE,
        onSaved: vi.fn(),
      }),
    )
    await act(async () => {
      clickButton(node(), 'Näita')
      await Promise.resolve()
    })
    expect(node().textContent).toContain('38705160217')
    expect(node().textContent).not.toContain('3870516*****')
    expect(node().textContent).toContain('Vaatamine logitud auditisse')

    await act(async () => {
      clickButton(node(), 'Peida')
      await Promise.resolve()
    })
    expect(node().textContent).not.toContain('38705160217')
  })

  it('omits the reveal row without an isikukood', async () => {
    await mount(
      createElement(DataCard, {
        account: { ...ACCOUNT, isikukood: null },
        profile: PRIVATE,
        onSaved: vi.fn(),
      }),
    )
    expect(node().textContent).not.toContain('Näita')
  })
})

describe('ProfilesCard', () => {
  it('marks the active profile and offers switching for the other', async () => {
    await mount(
      createElement(ProfilesCard, {
        profiles: [PRIVATE, COMPANY],
        account: ACCOUNT,
        activeId: 'p1',
        selectingId: null,
        selectError: null,
        onSelect: vi.fn(),
      }),
    )
    expect(node().textContent).toContain('Aktiivne profiil')
    expect(node().textContent).toContain('Kinnitatud')
    expect(node().textContent).toContain('Tamm OÜ')
    expect(node().textContent).toContain('14309277')
    // The active private profile shows no switch button; the company does,
    // plus the registry re-lookup.
    expect(textOf(node())).toContain('Võta kasutusele')
    expect(node().querySelectorAll('button')).toHaveLength(2)
    const addCompany = node().querySelector('a[href="/register"]')
    expect(addCompany?.textContent).toContain('Lisa ettevõte')
  })
})

describe('DeleteAccountModal', () => {
  it('lists deleted and kept data with the 7-year retention note', async () => {
    await mount(
      createElement(DeleteAccountModal, { isOpen: true, onClose: vi.fn() }),
    )
    const body = document.body
    expect(body.textContent).toContain('Kustuta konto?')
    expect(body.textContent).toContain('Kustutame: konto ja profiilid')
    expect(body.textContent).toContain(
      'Säilitame: lõppenud oksjonite pakkumised',
    )
    expect(body.textContent).toContain('7 aastat')
  })

  it('keeps the confirm honest while no portal endpoint exists', async () => {
    await mount(
      createElement(DeleteAccountModal, { isOpen: true, onClose: vi.fn() }),
    )
    await act(async () => {
      clickButton(document.body, 'Jätka kustutamist')
      await Promise.resolve()
    })
    expect(document.body.textContent).toContain('toe kaudu')
  })
})
