import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { SpecialistCard } from '../components/content/SpecialistCard'

describe('SpecialistCard', () => {
  it('renders mini card with name, role, phone, and email', () => {
    render(
      <SpecialistCard
        mini
        name="Peeter Põder"
        role="metsakonsultant"
        phone="+372 5000 0004"
        email="peeter.poder@erametsad.ee"
      />
    )

    expect(screen.getByText('Peeter Põder')).toBeDefined()
    expect(screen.getByText('metsakonsultant')).toBeDefined()

    const phoneLink = screen.getByRole('link', { name: '+372 5000 0004' })
    expect(phoneLink.getAttribute('href')).toBe('tel:+37250000004')
    expect(phoneLink.className).toContain('whitespace-nowrap')

    const emailLink = screen.getByRole('link', { name: 'peeter.poder@erametsad.ee' })
    expect(emailLink.getAttribute('href')).toBe('mailto:peeter.poder@erametsad.ee')
    expect(emailLink.className).toContain('truncate')
  })

  it('renders initial avatar when image is not provided', () => {
    render(
      <SpecialistCard
        mini
        name="Peeter Põder"
        role="metsakonsultant"
      />
    )

    expect(screen.getByText('P')).toBeDefined()
  })

  it('renders full card with contact info', () => {
    render(
      <SpecialistCard
        name="Mari Mets"
        role="Metsaspetsialist"
        phone="+372 555 1234"
        email="mari@erametsad.ee"
      />
    )

    expect(screen.getByText('Mari Mets')).toBeDefined()
    expect(screen.getByText('Metsaspetsialist')).toBeDefined()

    const phoneLink = screen.getByRole('link', { name: '+372 555 1234' })
    expect(phoneLink.getAttribute('href')).toBe('tel:+3725551234')
    expect(phoneLink.className).toContain('whitespace-nowrap')
  })
})

