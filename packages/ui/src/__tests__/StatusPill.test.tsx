import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusPill } from '../components/StatusPill'

describe('StatusPill', () => {
  it.each([
    ['active', 'Aktiivne'],
    ['endingSoon', 'Lõppemas'],
    ['critical', 'Kriitiline'],
    ['ended', 'Lõppenud'],
    ['draft', 'Mustand'],
    ['scheduled', 'Plaanitud'],
  ] as const)('renders the existing "%s" label', (status, label) => {
    render(<StatusPill status={status} />)
    expect(screen.getByText(label)).toBeDefined()
  })

  it.each([
    ['sealedOpeningPending', 'Ootel avamine'],
    ['won', 'Võitsid'],
    ['lost', 'Ei võitnud'],
    ['unsold', 'Müümata'],
    ['unread', 'Lugemata'],
    ['leading', 'Juhtiv pakkumine'],
  ] as const)('renders the portal "%s" label', (status, label) => {
    render(<StatusPill status={status} />)
    expect(screen.getByText(label)).toBeDefined()
  })

  it('keeps the exact classes the legacy statuses have always rendered', () => {
    render(<StatusPill status="active" />)
    expect(screen.getByText('Aktiivne')).toHaveClass(
      'bg-status-active/10',
      'text-status-active',
    )
  })

  it('colors new portal statuses with token classes Tailwind can generate', () => {
    render(<StatusPill status="leading" />)
    expect(screen.getByText('Juhtiv pakkumine')).toHaveClass(
      'bg-statusActive/10',
      'text-statusActive',
    )
  })

  it('supports the sm size', () => {
    render(<StatusPill status="won" size="sm" />)
    expect(screen.getByText('Võitsid')).toHaveClass('px-1.5', 'py-0.5', 'text-[11px]')
  })
})
