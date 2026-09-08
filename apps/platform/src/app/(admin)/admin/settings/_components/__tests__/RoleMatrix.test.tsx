// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'

import { RoleMatrix } from '../RoleMatrix'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

async function mountMatrix(): Promise<void> {
  await act(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(createElement(RoleMatrix))
    await Promise.resolve()
  })
}

async function unmountMatrix(): Promise<void> {
  await act(async () => {
    root.unmount()
    await Promise.resolve()
  })
  container.remove()
}

afterEach(async () => {
  await unmountMatrix()
})

function headerCells(): HTMLTableCellElement[] {
  return [...container.querySelectorAll<HTMLTableCellElement>('thead th')]
}

function bodyRows(): HTMLTableRowElement[] {
  return [...container.querySelectorAll<HTMLTableRowElement>('tbody tr')]
}

describe('RoleMatrix', () => {
  it('renders every role column in demo order with Superadmin locked last', async () => {
    await mountMatrix()

    const headers = headerCells()
    expect(headers.map((th) => th.textContent)).toEqual([
      'Õigus',
      'Spetsialist',
      'Müüja',
      'Admin',
      'Superadmin',
    ])
    expect(headers[1]?.querySelector('svg')).toBeNull()
    expect(headers[4]?.querySelector('svg')).not.toBeNull()
  })

  it('renders one row per code-defined permission group with four role cells', async () => {
    await mountMatrix()

    const rows = bodyRows()
    expect(rows.map((row) => row.querySelector('td')?.textContent)).toEqual([
      'Töölaud',
      'Oksjonid',
      'Pakkumised ja sulgemise avamine',
      'Juhtlõimed ja päringud',
      'Kasutajad ja ettevõtted',
      'Lepingud',
      'Sisu',
      'Statistika',
      'Seaded',
      'Auditlogi',
    ])
    for (const row of rows) {
      expect(row.querySelectorAll('td')).toHaveLength(5)
    }
  })

  it('locks the Superadmin column with always-granted disabled cells', async () => {
    await mountMatrix()

    const rows = bodyRows()
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      const cells = [...row.querySelectorAll('td')]
      const box = cells[4]?.querySelector<HTMLInputElement>('input[type="checkbox"]')
      expect(box).not.toBeNull()
      expect(box?.checked).toBe(true)
      expect(box?.disabled).toBe(true)
      expect(box?.getAttribute('aria-label')).toContain('alati lubatud')
    }
  })

  it('renders no interactive controls anywhere in the matrix', async () => {
    await mountMatrix()

    const inputs = [...container.querySelectorAll('input')]
    expect(inputs.length).toBeGreaterThan(0)
    for (const input of inputs) {
      expect(input.disabled).toBe(true)
    }
    expect(container.querySelectorAll('button, select, textarea, a')).toHaveLength(0)
  })

  it('marks partially granted groups with the Estonian partial label', async () => {
    await mountMatrix()

    const partial = container.querySelector(
      '[role="img"][aria-label="Spetsialist: Oksjonid (osaliselt lubatud)"]',
    )
    expect(partial).not.toBeNull()
  })

  it('marks denied groups with the Estonian denied label', async () => {
    await mountMatrix()

    const denied = container.querySelector<HTMLInputElement>(
      'input[aria-label="Müüja: Juhtlõimed ja päringud (keelatud)"]',
    )
    expect(denied).not.toBeNull()
    expect(denied?.checked).toBe(false)
  })

  it('carries the Estonian note about code-defined permissions', async () => {
    await mountMatrix()

    const note = container.querySelector('p')
    expect(note?.textContent).toContain('Õigused on määratletud koodis')
    expect(note?.textContent).toContain('permissions.ts')
    expect(note?.textContent).toContain('Superadmini veerg on alati täielik ja lukustatud.')
  })
})
