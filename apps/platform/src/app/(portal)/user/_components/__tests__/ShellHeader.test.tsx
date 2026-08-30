import { createElement, type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
  usePathname: () => '/user/bids',
}))

vi.mock('next/link', () => ({
  default: (props: { href: string; children: ReactNode }) =>
    createElement('a', { href: props.href }, props.children),
}))

vi.mock('@/app/(portal)/_lib/use-my-stream', () => ({
  useMyStream: () => ({
    status: 'connecting',
    subscribe: () => () => undefined,
    onReconnect: () => () => undefined,
  }),
}))

vi.mock('@/app/(portal)/_actions/logout', () => ({
  logoutAction: () => Promise.resolve(),
}))

import { ShellHeader, toSwitcherOption, type ProfileSummary } from '../ShellHeader'

function profile(overrides: Partial<ProfileSummary> = {}): ProfileSummary {
  return { id: 'p1', type: 'private', displayName: 'Mari Maasikas', ...overrides }
}

describe('toSwitcherOption', () => {
  it('marks the profile whose display name matches the header name active', () => {
    const option = toSwitcherOption(profile(), 'Mari Maasikas')
    expect(option.active).toBe(true)
    expect(option.disabled).toBe(false)
    expect(option.name).toBe('Mari Maasikas')
  })

  it('names a company profile by companyName like the server layout', () => {
    const option = toSwitcherOption(
      profile({ id: 'p2', type: 'company', displayName: 'Mari OÜ', companyName: 'Mari Mets OÜ', approvalStatus: 'approved' }),
      'Mari Mets OÜ',
    )
    expect(option.name).toBe('Mari Mets OÜ')
    expect(option.active).toBe(true)
  })

  it('falls back to displayName when companyName is missing', () => {
    const option = toSwitcherOption(
      profile({ id: 'p2', type: 'company', companyName: null, approvalStatus: 'approved' }),
      'Mari Maasikas',
    )
    expect(option.name).toBe('Mari Maasikas')
    expect(option.active).toBe(true)
  })

  it('uses the same fallback labels as the select-profile page', () => {
    expect(toSwitcherOption(profile({ type: 'company', displayName: null }), null).name).toBe(
      'Ettevõte',
    )
    expect(toSwitcherOption(profile({ displayName: null }), null).name).toBe('Eraisik')
  })

  it('disables an unapproved company profile and never marks it active', () => {
    const option = toSwitcherOption(
      profile({ id: 'p2', type: 'company', companyName: 'Mets OÜ', approvalStatus: 'pending' }),
      'Mets OÜ',
    )
    expect(option.disabled).toBe(true)
    expect(option.active).toBe(false)
  })

  it('marks nothing active without a header profile name', () => {
    expect(toSwitcherOption(profile(), null).active).toBe(false)
    expect(toSwitcherOption(profile(), 'Teine Nimi').active).toBe(false)
  })
})

describe('ShellHeader markup', () => {
  it('renders the header chip and keeps the profile menu closed initially', () => {
    const html = renderToString(createElement(ShellHeader, { profileName: 'Mari Maasikas' }))
    expect(html).toContain('Mari Maasikas')
    expect(html).not.toContain('Logi välja')
    expect(html).not.toContain('Profiilid')
  })

  it('falls back to Minu konto without a profile name', () => {
    const html = renderToString(createElement(ShellHeader, { profileName: null }))
    expect(html).toContain('Minu konto')
  })
})
