import { createElement, type ReactElement, type ReactNode } from 'react'
import { prerender } from 'react-dom/static'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: (props: { href: string; children?: ReactNode }) =>
    createElement('a', { href: props.href }, props.children),
}))

vi.mock('@/app/(marketing)/_lib/base-url', () => ({
  marketingUrl: (path: string) => `https://erametsad.ww0.dev${path}`,
}))

const state = vi.hoisted(() => ({
  settingsRow: null as Record<string, unknown> | null,
  rejectRead: false,
}))

vi.mock('@/lib/data/runtime', () => ({
  getRepositories: vi.fn(() =>
    state.rejectRead
      ? Promise.reject(new Error('no D1 binding'))
      : Promise.resolve({
          find: (options: { collection: string }) =>
            options.collection === 'settings'
              ? Promise.resolve({ docs: state.settingsRow ? [state.settingsRow] : [] })
              : Promise.resolve({ docs: [] }),
        }),
  ),
}))

import { PortalFooter } from '../PortalFooter'

const emptyFlags = {
  requireFrameworkContract: true,
  'social.facebook_url': '',
  'social.instagram_url': '',
  'social.youtube_url': '',
}

// React SSR separates adjacent text nodes with <!-- --> comments; strip
// them so the assertions read like the page text.
function plain(html: string): string {
  return html.replace(/<!--.*?-->/g, '')
}

// The footer is an async server component, so the tree renders with
// react-dom/static's prerender, which awaits async components.
async function renderFooter(): Promise<string> {
  const tree = (await PortalFooter()) as ReactElement
  const { prelude } = await prerender(tree)
  return plain(await new Response(prelude).text())
}

beforeEach(() => {
  state.settingsRow = { id: 'settings-1', featureFlags: { ...emptyFlags } }
  state.rejectRead = false
})

describe('PortalFooter social links (task 5.1)', () => {
  it('renders the three link columns and no Jälgi meid column when all keys are empty', async () => {
    const html = await renderFooter()

    expect(html).not.toContain('Jälgi meid')
    for (const title of ['Oksjonid', 'Ajalugu', 'Erametsad']) {
      expect(html).toContain(title)
    }
    expect(html).not.toContain('aria-label="Facebook"')
    expect(html).not.toContain('aria-label="Instagram"')
    expect(html).not.toContain('aria-label="YouTube"')
  })

  it('shows the Facebook icon only when only social.facebook_url is set', async () => {
    state.settingsRow = {
      id: 'settings-1',
      featureFlags: {
        ...emptyFlags,
        'social.facebook_url': 'https://facebook.com/erametsad',
      },
    }

    const html = await renderFooter()

    expect(html).toContain('Jälgi meid')
    expect(html).toContain('href="https://facebook.com/erametsad"')
    expect(html).not.toContain('aria-label="Instagram"')
    expect(html).not.toContain('aria-label="YouTube"')
  })

  it('shows all three icons when every key is set', async () => {
    state.settingsRow = {
      id: 'settings-1',
      featureFlags: {
        'social.facebook_url': 'https://facebook.com/erametsad',
        'social.instagram_url': 'https://instagram.com/erametsad',
        'social.youtube_url': 'https://youtube.com/@erametsad',
      },
    }

    const html = await renderFooter()

    expect(html).toContain('aria-label="Facebook"')
    expect(html).toContain('aria-label="Instagram"')
    expect(html).toContain('aria-label="YouTube"')
  })

  it('treats a missing settings row like an empty one', async () => {
    state.settingsRow = null

    const html = await renderFooter()

    expect(html).not.toContain('Jälgi meid')
    expect(html).toContain('Oksjonid')
  })

  it('hides the column instead of crashing when the settings read fails', async () => {
    state.rejectRead = true

    const html = await renderFooter()

    expect(html).not.toContain('Jälgi meid')
    expect(html).toContain('Oksjonid')
    expect(html).toContain('Küpsisesätted')
  })
})
