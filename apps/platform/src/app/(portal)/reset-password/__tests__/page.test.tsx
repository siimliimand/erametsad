import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { PasswordResetRequestForm } from '../../_components/PasswordForm'
import ResetPasswordPage from '../page'

// The page is an async server component: await it, then walk the returned
// tree for the form element and inspect its props directly.
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

async function pageProps(searchParams: { next?: string }): Promise<{
  html: string
  props: Record<string, unknown>
}> {
  const tree = await ResetPasswordPage({
    searchParams: Promise.resolve(searchParams),
  })
  const form = findElement(tree, PasswordResetRequestForm)
  if (form === null) throw new Error('PasswordResetRequestForm not found in page tree')
  return { html: renderToString(tree), props: form.props as Record<string, unknown> }
}

describe('reset-password request page', () => {
  it('renders the auth card with neutral copy and a serializable next prop', async () => {
    const { html, props } = await pageProps({ next: '/minu/pakkumised' })

    expect(html).toContain('Parooli taastamine')
    expect(html).toContain('Unustasid parooli?')
    expect(props.next).toBe('/minu/pakkumised')
    // No function props may cross the server/client boundary.
    expect(Object.values(props).every((value) => typeof value !== 'function')).toBe(true)
  })

  it('drops an unsafe next value instead of passing it on', async () => {
    const { props } = await pageProps({ next: '//evil.example' })
    expect(props.next).toBeNull()
  })
})
