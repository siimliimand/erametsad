import { createElement, type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}))

vi.mock('next/link', () => ({
  default: (props: { href: string; className?: string; children: ReactNode }) =>
    createElement('a', { href: props.href, className: props.className }, props.children),
}))

import { BidPanel, type BidPanelProps } from '../BidPanel'

function baseProps(overrides: Partial<BidPanelProps> = {}): BidPanelProps {
  return {
    auctionId: 'a1',
    objectType: 'raieoigus',
    status: 'active',
    startsAt: null,
    endsAt: '2026-09-30T12:00:00.000Z',
    minBid: 1000,
    bidStep: 50,
    leadingBidAmount: null,
    finalPrice: null,
    antiSnipeMinutes: null,
    viewer: {
      hasBid: false,
      isLeading: false,
      hasRights: true,
      hasRaamleping: true,
    },
    ...overrides,
  }
}

function render(props: BidPanelProps): string {
  return renderToString(createElement(BidPanel, props))
}

// The page passes allowUnderStart only for open active auctions when
// Settings.alapakkumineEnabled is true (task 3.1); the toggle must appear
// exactly there and nowhere else.
describe('BidPanel alapakkumine toggle gating', () => {
  it('renders the toggle when allowUnderStart is true', () => {
    const html = render(baseProps({ allowUnderStart: true }))
    expect(html).toContain('role="switch"')
    expect(html).toContain('aria-checked="false"')
    expect(html).toContain('Alapakkumine alghinnast madalamalt')
    expect(html).toContain('Nõuab müüja nõusolekut')
  })

  it('hides the toggle when allowUnderStart is omitted (default false)', () => {
    const html = render(baseProps())
    expect(html).not.toContain('role="switch"')
    expect(html).not.toContain('Alapakkumine alghinnast madalamalt')
  })

  it('hides the toggle when allowUnderStart is false', () => {
    const html = render(baseProps({ allowUnderStart: false }))
    expect(html).not.toContain('role="switch"')
    expect(html).not.toContain('Alapakkumine alghinnast madalamalt')
  })

  it('hides the toggle on the guest panel even when allowed', () => {
    const html = render(baseProps({ viewer: null, allowUnderStart: true }))
    expect(html).toContain('Logi sisse pakkumise tegemiseks.')
    expect(html).not.toContain('role="switch"')
    expect(html).not.toContain('Alapakkumine alghinnast madalamalt')
  })

  it('hides the toggle on the ended panel even when allowed', () => {
    const html = render(
      baseProps({ status: 'ended', finalPrice: 1500, allowUnderStart: true }),
    )
    expect(html).toContain('Oksjon on lõppenud')
    expect(html).not.toContain('role="switch"')
    expect(html).not.toContain('Alapakkumine alghinnast madalamalt')
  })

  it('hides the toggle on the scheduled panel even when allowed', () => {
    const html = render(
      baseProps({ status: 'scheduled', startsAt: '2026-09-15T10:00:00.000Z', allowUnderStart: true }),
    )
    expect(html).toContain('Oksjon pole veel alanud.')
    expect(html).not.toContain('role="switch"')
    expect(html).not.toContain('Alapakkumine alghinnast madalamalt')
  })
})
