import { createElement, type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: (props: { href: string; className?: string; children?: ReactNode }) =>
    createElement('a', { href: props.href, className: props.className }, props.children),
}))

import { LoginForm } from '../_components/LoginForm'

// React SSR separates adjacent text nodes with <!-- --> comments; strip them
// so text assertions read like the rendered text.
function plain(value: string): string {
  return value.replace(/<!--.*?-->/g, '')
}

function renderLogin(next: string | null = null): string {
  return plain(
    renderToString(
      createElement(LoginForm, {
        next,
        privacyHref: 'https://erametsad.ee/lepingud/dokumendid',
      }),
    ),
  )
}

describe('LoginForm', () => {
  it('renders the demo 440px card with method choice and links', () => {
    const html = renderLogin()

    expect(html).toContain('max-w-[440px]')
    expect(html).toContain('Logi sisse')
    expect(html).toContain('Vali turvaline tuvastusmeetod')
    expect(html).toContain('või')
    expect(html).toContain('Logi sisse parooliga')
    expect(html).toContain('Pole veel kasutajat?')
    expect(html).toContain('Loo konto')
    expect(html).toContain('Turvaline sisselogimine EU eIDAS tasemega')
    expect(html).toContain('privaatsuspoliitikat')
    expect(html).toContain('Tagasi oksjonitele')
  })

  it('renders the three demo eID methods with their hints', () => {
    const html = renderLogin()

    expect(html).toContain('Smart-ID')
    expect(html).toContain('Kiireim viis — kinnita telefonis PIN1')
    expect(html).toContain('Mobiil-ID')
    expect(html).toContain('Kinnituskood saadetakse SMS-iga')
    expect(html).toContain('ID-kaart')
    expect(html).toContain('Kaardilugejaga, kinnita arvutis PIN1')
  })

  it('keeps next in the register and reset links', () => {
    const html = renderLogin('/oksjon/abc')

    expect(html).toContain('href="/register?next=%2Foksjon%2Fabc"')
    expect(html).toContain('href="/reset-password?next=%2Foksjon%2Fabc"')
    expect(html).toContain('Unustasid salasõna?')
  })

  it('links reset and register without next by default', () => {
    const html = renderLogin()

    expect(html).toContain('href="/reset-password"')
    expect(html).toContain('href="/register"')
  })
})
