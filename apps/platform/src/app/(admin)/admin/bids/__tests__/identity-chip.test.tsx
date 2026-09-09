// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const revealAction = vi.hoisted(() => vi.fn())

vi.mock('../../../_actions/auctions', () => ({
  revealBidderIdentityAction: revealAction,
}))

import { IdentityRevealChip } from '../_components/identity-chip'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

let container: HTMLDivElement
let root: Root

async function mountChip(props: {
  bidId: string
  bidderId?: string | null
  canViewUsers?: boolean
}): Promise<void> {
  await act(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(createElement(IdentityRevealChip, props))
    await Promise.resolve()
  })
}

async function unmountChip(): Promise<void> {
  await act(async () => {
    root.unmount()
    await Promise.resolve()
  })
  container.remove()
}

async function clickReveal(): Promise<void> {
  const button = [...container.querySelectorAll('button')].find((candidate) =>
    candidate.textContent.includes('Näita identiteeti'),
  )
  if (button === undefined) throw new Error('reveal button not found')
  await act(async () => {
    button.click()
    await sleep(5)
  })
}

beforeEach(() => {
  revealAction.mockResolvedValue({
    ok: true,
    identity: { name: 'Mari Maasikas', email: 'mari@naide.ee' },
  })
})

afterEach(async () => {
  await unmountChip()
  revealAction.mockReset()
})

describe('IdentityRevealChip user-detail link', () => {
  it('links the revealed identity to the Kasutajad detail for users:read roles', async () => {
    await mountChip({ bidId: 'bid-1', bidderId: 'user-9', canViewUsers: true })
    await clickReveal()

    const link = [...container.querySelectorAll('a')].find((candidate) =>
      candidate.textContent.includes('Mari Maasikas'),
    )
    expect(link?.getAttribute('href')).toBe('/admin/users/user-9')
  })

  it('keeps the revealed identity unlinked without users:read', async () => {
    await mountChip({ bidId: 'bid-1', bidderId: 'user-9', canViewUsers: false })
    await clickReveal()

    expect(container.textContent).toContain('Mari Maasikas')
    expect(container.querySelector('a')).toBeNull()
  })

  it('renders the server error when the reveal is denied', async () => {
    revealAction.mockResolvedValue({ ok: false, error: 'Identiteet on nähtav ainult alapakkumise otsuse korral.' })
    await mountChip({ bidId: 'bid-1', bidderId: 'user-9', canViewUsers: true })
    await clickReveal()

    expect(container.textContent).toContain('Identiteet on nähtav ainult alapakkumise otsuse korral.')
    expect(container.querySelector('a')).toBeNull()
  })
})
