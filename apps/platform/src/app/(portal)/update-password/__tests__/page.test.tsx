import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: (props: { href: string; className?: string; children?: ReactNode }) =>
    createElement('a', { href: props.href, className: props.className }, props.children),
}))

const sessionMock = vi.hoisted(() => ({
  requirePortalSession: vi.fn(),
}))
const runtimeMock = vi.hoisted(() => ({
  getRepositories: vi.fn(),
}))

vi.mock('@/app/(portal)/_lib/session', () => sessionMock)
vi.mock('@/lib/data/runtime', () => runtimeMock)

import { PasswordForm } from '../../_components/PasswordForm'
import UpdatePasswordPage from '../page'

const ISIKUKOOD = '32708100019'

// The page is an async server component: await it, then walk the returned
// tree for the PasswordForm element and inspect its props directly.
function findElement(node: ReactNode, type: unknown): ReactElement | null {
  if (Array.isArray(node)) {
    const items = node as unknown as ReactNode[]
    for (const child of items) {
      const found = findElement(child, type)
      if (found !== null) return found
    }
    return null
  }
  if (!isValidElement(node)) return null
  if (node.type === type) return node
  const owner = node as unknown as { props: { children?: ReactNode } }
  return findElement(owner.props.children, type)
}

async function formProps(searchParams: { first?: string }): Promise<{
  html: string
  props: Record<string, unknown>
}> {
  const tree = await UpdatePasswordPage({
    searchParams: Promise.resolve(searchParams),
  })
  const form = findElement(tree, PasswordForm)
  if (form === null) throw new Error('PasswordForm not found in page tree')
  return { html: renderToString(tree), props: form.props as Record<string, unknown> }
}

function stubSessionAndUser(isikukood: string | null): void {
  sessionMock.requirePortalSession.mockResolvedValue({ session: { userId: 'u1' } })
  runtimeMock.getRepositories.mockResolvedValue({
    findByID: vi.fn().mockResolvedValue({ id: 'u1', isikukood }),
  })
}

describe('update-password page', () => {
  it('renders the first-set form for ?first=1 with serializable props', async () => {
    stubSessionAndUser(ISIKUKOOD)

    const { html, props } = await formProps({ first: '1' })

    expect(html).toContain('Määra parool')
    expect(html).toContain('Sinu konto on loodud eID kaudu ja parool puudub.')
    expect(props.endpoint).toBe('/api/v1/auth/change-password')
    expect(props.isikukood).toBe(ISIKUKOOD)
    expect(props.withCurrentPassword).toBe(false)
    expect(props.submitLabel).toBe('Määra parool')
    // No function props may cross the server/client boundary.
    expect(Object.values(props).every((value) => typeof value !== 'function')).toBe(true)
  })

  it('renders the change form with the current password field by default', async () => {
    stubSessionAndUser(ISIKUKOOD)

    const { html, props } = await formProps({})

    expect(html).toContain('Muuda parool')
    expect(html).not.toContain('Sinu konto on loodud eID kaudu')
    expect(props.withCurrentPassword).toBe(true)
    expect(props.isikukood).toBe(ISIKUKOOD)
    expect(Object.values(props).every((value) => typeof value !== 'function')).toBe(true)
  })

  it('feeds the strength meter a null isikukood when the row has none', async () => {
    stubSessionAndUser(null)

    const { props } = await formProps({ first: '1' })
    expect(props.isikukood).toBeNull()
  })
})
