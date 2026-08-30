import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'

import { createElement, type ReactNode } from 'react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}))

vi.mock('next/link', () => ({
  default: (props: { href: string; className?: string; children: ReactNode }) =>
    createElement('a', { href: props.href, className: props.className }, props.children),
}))

import {
  BidPanel,
  PendingApprovalChip,
  minimumNextAmount,
  validateBidAmount,
  type BidPanelProps,
} from '../BidPanel'

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

// React SSR separates adjacent text nodes with <!-- --> comments and ICU
// emits narrow/no-break spaces; strip both so assertions read like the text.
function plain(value: string): string {
  return value
    .replace(/<!--.*?-->/g, '')
    .replace(/[\u00a0\u202f]/g, ' ')
}

function expectAmount(html: string, amount: number, currency: boolean): void {
  const formatted = currency
    ? amount.toLocaleString('et-EE', { style: 'currency', currency: 'EUR' })
    : amount.toLocaleString('et-EE', { maximumFractionDigits: 2 })
  expect(plain(html)).toContain(plain(formatted))
}

describe('BidPanel states', () => {
  it('renders the guest panel with the login CTA', () => {
    const html = render(baseProps({ viewer: null }))
    expect(html).toContain('Pakkumine')
    expect(html).toContain('Logi sisse pakkumise tegemiseks.')
    expect(html).toContain('/login?next=%2Foksjon%2Fa1')
    expect(html).toContain('>Logi sisse</a>')
    expect(html).not.toContain('<form')
    expect(html).not.toContain('Esita pakkumine')
  })

  it('renders the scheduled panel with the start time and no form', () => {
    const startsAt = '2026-09-15T10:00:00.000Z'
    const html = render(baseProps({ status: 'scheduled', startsAt }))
    expect(html).toContain('Oksjon pole veel alanud.')
    expect(html).toContain('Oksjon algab:')
    const expected = new Date(startsAt).toLocaleString('et-EE', {
      dateStyle: 'long',
      timeStyle: 'short',
    })
    expect(plain(html)).toContain(plain(expected))
    expect(html).not.toContain('<form')
  })

  it('renders the draft panel like scheduled', () => {
    const html = render(baseProps({ status: 'draft' }))
    expect(html).toContain('Oksjon pole veel alanud.')
    expect(html).not.toContain('Oksjon algab:')
  })

  it('renders the ended panel with the final price and no input', () => {
    const html = render(baseProps({ status: 'ended', finalPrice: 12345.5 }))
    expect(html).toContain('Oksjon on lõppenud')
    expect(html).toContain('Lõpphind:')
    expectAmount(html, 12345.5, true)
    expect(html).not.toContain('<input')
    expect(html).not.toContain('Esita pakkumine')
  })

  it('renders the ended panel without a price line when finalPrice is null', () => {
    const html = render(baseProps({ status: 'ended', finalPrice: null }))
    expect(html).toContain('Oksjon on lõppenud')
    expect(html).not.toContain('Lõpphind:')
  })

  it('renders the unsold panel', () => {
    const html = render(baseProps({ status: 'unsold' }))
    expect(html).toContain('Oksjon jäi müümata')
    expect(html).not.toContain('<form')
  })

  it('renders the no-rights panel for viewers without bidding rights', () => {
    const html = render(
      baseProps({ viewer: { ...baseProps().viewer!, hasRights: false } }),
    )
    expect(html).toContain('Sul ei ole õigust selle objektitüübi pakkumiste tegemiseks.')
    expect(html).toContain('Pakkumisõiguse saamiseks pöördu müüja poole.')
    expect(html).not.toContain('<form')
  })
})

describe('BidPanel active state', () => {
  it('shows the start price when no bids exist yet', () => {
    const html = render(baseProps())
    expect(html).toContain('Alghind')
    expectAmount(html, 1000, true)
    expect(html).toContain('Pakkumisi veel pole. Esita esimene pakkumine.')
  })

  it('shows the leading bid and the current+step minimum', () => {
    const html = render(baseProps({ leadingBidAmount: 1000 }))
    expect(html).toContain('Juhtiv pakkumine')
    expectAmount(html, 1000, true)
    expect(plain(html)).toContain('Vähim lubatud pakkumine: 1050 €')
  })

  it('renders the bid form with label, step buttons and submit', () => {
    const html = render(baseProps())
    expect(html).toContain('<form')
    expect(html).toContain('Sinu pakkumine (€)')
    expect(html).toContain('aria-label="Vähenda pakkumist sammu võrra"')
    expect(html).toContain('aria-label="Suurenda pakkumist sammu võrra"')
    expect(html).toContain('Esita pakkumine')
  })

  it('leaves the step buttons enabled when a bid step is defined', () => {
    const html = render(baseProps({ bidStep: 50 }))
    expect(html).not.toContain('disabled=""')
  })

  it('disables the step buttons when the auction defines no step', () => {
    const html = render(baseProps({ bidStep: null }))
    const disabledCount = html.split('disabled=""').length - 1
    expect(disabledCount).toBe(2)
  })

  it('shows the anti-snipe notice only when minutes are configured', () => {
    const withNotice = render(baseProps({ antiSnipeMinutes: 5 }))
    expect(withNotice).toContain('pikendab oksjoni lõpuaega')
    const withoutNotice = render(baseProps({ antiSnipeMinutes: null }))
    expect(withoutNotice).not.toContain('pikendab oksjoni lõpuaega')
  })

  it('warns when the viewer has not signed the raamleping', () => {
    const html = render(
      baseProps({ viewer: { ...baseProps().viewer!, hasRaamleping: false } }),
    )
    expect(html).toContain(
      'Enampakkumise tegemiseks tuleb esmalt allkirjastada raamleping.',
    )
  })
})

describe('PendingApprovalChip', () => {
  it('renders the seller-approval chip text', () => {
    const html = renderToString(createElement(PendingApprovalChip))
    expect(html).toContain('Alapakkumine ootab müüja kinnitust')
  })
})

describe('minimumNextAmount', () => {
  it('returns the start price when nobody leads', () => {
    expect(minimumNextAmount(1000, 50, null)).toBe(1000)
  })

  it('returns leading bid + step when somebody leads', () => {
    expect(minimumNextAmount(1000, 50, 1000)).toBe(1050)
    expect(minimumNextAmount(1000, 50, 2725)).toBe(2775)
  })

  it('returns the leading bid unchanged when there is no step', () => {
    expect(minimumNextAmount(1000, null, 1000)).toBe(1000)
    expect(minimumNextAmount(1000, null, null)).toBe(1000)
  })
})

describe('validateBidAmount', () => {
  it('accepts an amount at the minimum', () => {
    expect(validateBidAmount('1050', 1000, 1050, false, false)).toEqual({
      ok: true,
      amount: 1050,
    })
  })

  it('parses comma decimals and inner spaces', () => {
    expect(validateBidAmount(' 1 050,50 ', 1000, 1050, false, false)).toEqual({
      ok: true,
      amount: 1050.5,
    })
  })

  it('rejects empty, garbage, zero and negative input', () => {
    const expected = 'Sisesta korrektne summa eurodes.'
    expect(validateBidAmount('', 1000, 1050, false, false)).toEqual({
      ok: false,
      message: expected,
    })
    expect(validateBidAmount('abc', 1000, 1050, false, false)).toEqual({
      ok: false,
      message: expected,
    })
    expect(validateBidAmount('0', 1000, 1050, false, false)).toEqual({
      ok: false,
      message: expected,
    })
    expect(validateBidAmount('-5', 1000, 1050, false, false)).toEqual({
      ok: false,
      message: expected,
    })
  })

  it('rejects an amount below the minimum with the Estonian message', () => {
    expect(validateBidAmount('999', 1000, 1050, false, false)).toEqual({
      ok: false,
      message: 'Pakkumine peab olema vähemalt 1050 €.',
    })
  })

  it('allows an under-start amount only when alapakkumine is requested and enabled', () => {
    expect(validateBidAmount('900', 1000, 1050, true, true)).toEqual({
      ok: true,
      amount: 900,
    })
    expect(validateBidAmount('900', 1000, 1050, true, false).ok).toBe(false)
    expect(validateBidAmount('900', 1000, 1050, false, true).ok).toBe(false)
  })

  it('still blocks amounts between the start price and the minimum', () => {
    // 1020 is above minBid (not under-start) but below leading + step.
    expect(validateBidAmount('1020', 1000, 1050, true, true).ok).toBe(false)
  })

  it('does not enforce step multiples client-side', () => {
    expect(validateBidAmount('1051', 1000, 1050, false, false)).toEqual({
      ok: true,
      amount: 1051,
    })
  })
})
