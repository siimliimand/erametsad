import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: (props: { href: string; className?: string; children?: ReactNode }) =>
    createElement('a', { href: props.href, className: props.className }, props.children),
}))

import { PasswordForm } from '../../../_components/PasswordForm'
import ResetPasswordTokenPage from '../page'

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

describe('reset-password token page', () => {
  it('renders with the token as a serializable prop, not a function', async () => {
    const tree = (await ResetPasswordTokenPage({
      params: Promise.resolve({ token: 'tok-abc' }),
    })) as ReactElement

    const html = renderToString(tree)
    expect(html).toContain('Määra uus parool')
    expect(html).toContain('Vali uus parool.')

    const form = findElement(tree, PasswordForm)
    if (form === null) throw new Error('PasswordForm not found in page tree')
    const props = form.props as Record<string, unknown>
    expect(props.endpoint).toBe('/api/v1/auth/reset-password')
    expect(props.resetToken).toBe('tok-abc')
    // No function props may cross the server/client boundary.
    expect(Object.values(props).every((value) => typeof value !== 'function')).toBe(true)
  })
})
