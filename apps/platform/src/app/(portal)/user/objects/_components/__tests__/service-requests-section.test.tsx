// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'

import { ServiceRequestsSection, type ServiceRequestRow } from '../service-requests-section'

function row(overrides: Partial<ServiceRequestRow> = {}): ServiceRequestRow {
  return {
    id: 'sr-1',
    type: 'kava',
    status: 'new',
    createdAt: '2026-08-01T10:00:00Z',
    ...overrides,
  }
}

let container: HTMLDivElement
let root: Root

function render(rows: ServiceRequestRow[]): void {
  act(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(createElement(ServiceRequestsSection, { rows }))
  })
}

function text(): string {
  return container.textContent
}

afterEach(() => {
  act(() => {
    root.unmount()
  })
  container.remove()
})

describe('ServiceRequestsSection', () => {
  it('renders the Teenused heading and rows with type labels, status pills, and dates', () => {
    render([
      row({}),
      row({ id: 'sr-2', type: 'hooldusraie', status: 'routed', createdAt: '2026-08-15T08:30:00Z' }),
      row({ id: 'sr-3', type: 'istutamine', status: 'teostatud' }),
      row({ id: 'sr-4', status: 'suletud' }),
    ])

    expect(text()).toContain('Teenused')
    expect(text()).toContain('Metsamajanduskava')
    expect(text()).toContain('Hooldusraie')
    expect(text()).toContain('Metsa istutamine')
    expect(text()).toContain('Uus')
    expect(text()).toContain('Suunatud')
    expect(text()).toContain('Teostatud')
    expect(text()).toContain('Suletud')
    expect(text()).toContain('Esitatud')
    // et-EE medium date shape (day. month year)
    expect(text()).toMatch(/1\.\s*\S+\s*2026/)
    expect(container.querySelectorAll('a')).toHaveLength(0)
  })

  it('shows the empty state with a pointer to the paku wizard when there are no requests', () => {
    render([])

    expect(text()).toContain('Teenused')
    expect(text()).toContain('Päringuid ei ole veel')
    expect(text()).not.toContain('Metsamajanduskava')
    const link = container.querySelector('a')
    expect(link?.getAttribute('href')).toBe('/user/objects/paku')
  })

  it('falls back to the raw status label for unknown statuses', () => {
    render([row({ status: 'uus-olek' })])
    expect(text()).toContain('uus-olek')
  })
})
