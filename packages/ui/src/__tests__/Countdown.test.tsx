import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { Countdown } from '../components/Countdown'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-08-27T12:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Countdown', () => {
  it('renders days, hours, minutes, seconds when > 24h remaining', () => {
    const endsAt = new Date('2026-08-30T12:00:00Z')
    render(<Countdown endsAt={endsAt} />)
    expect(screen.getByText(/3p 0h 0m 0s/)).toBeDefined()
  })

  it('renders hours, minutes, seconds when < 24h remaining', () => {
    const endsAt = new Date('2026-08-27T15:30:00Z')
    render(<Countdown endsAt={endsAt} />)
    expect(screen.getByText(/3h 30m 0s/)).toBeDefined()
  })

  it('shows "Lõppenud" when countdown ends', () => {
    const endsAt = new Date('2026-08-27T12:00:00Z')
    render(<Countdown endsAt={endsAt} />)
    expect(screen.getByText('Lõppenud')).toBeDefined()
  })

  it('shows "Lõppenud" when end time is in the past', () => {
    const endsAt = new Date('2026-08-27T11:00:00Z')
    render(<Countdown endsAt={endsAt} />)
    expect(screen.getByText('Lõppenud')).toBeDefined()
  })

  it('calls onEnd when countdown reaches zero', () => {
    const onEnd = vi.fn()
    const endsAt = new Date('2026-08-27T12:00:05Z')
    render(<Countdown endsAt={endsAt} onEnd={onEnd} />)

    act(() => {
      vi.advanceTimersByTime(5500)
    })

    expect(onEnd).toHaveBeenCalled()
  })

  it('fires onEnd exactly once even long after the deadline', () => {
    const onEnd = vi.fn()
    render(<Countdown endsAt={new Date('2026-08-27T12:00:03Z')} onEnd={onEnd} />)

    act(() => {
      vi.advanceTimersByTime(10_000)
    })

    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('fires onEnd again when a new deadline follows an extension', () => {
    const onEnd = vi.fn()
    const { rerender } = render(
      <Countdown endsAt={new Date('2026-08-27T12:00:02Z')} onEnd={onEnd} />,
    )

    act(() => {
      vi.advanceTimersByTime(5_000)
    })
    expect(onEnd).toHaveBeenCalledTimes(1)

    rerender(<Countdown endsAt={new Date('2026-08-27T12:01:00Z')} onEnd={onEnd} />)
    act(() => {
      vi.advanceTimersByTime(61_000)
    })

    expect(onEnd).toHaveBeenCalledTimes(2)
  })

  it('derives remaining time from serverNow instead of the client clock', () => {
    // System time is 12:00:00; the server anchor is 30s ahead of it, so the
    // drifted client must still show 30 seconds remaining.
    render(
      <Countdown
        endsAt={new Date('2026-08-27T12:01:00Z')}
        serverNow={Date.parse('2026-08-27T12:00:30Z')}
      />,
    )
    expect(screen.getByText(/0h 0m 30s/)).toBeDefined()
  })

  it('keeps ticking from the serverNow anchor after mount', () => {
    render(
      <Countdown
        endsAt={new Date('2026-08-27T12:01:00Z')}
        serverNow={Date.parse('2026-08-27T12:00:30Z')}
      />,
    )

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(screen.getByText(/0h 0m 28s/)).toBeDefined()
  })

  it('does not show "Aega jäänud" label when showLabel is false', () => {
    const endsAt = new Date('2026-08-30T12:00:00Z')
    render(<Countdown endsAt={endsAt} showLabel={false} />)
    expect(screen.queryByText('Aega jäänud')).toBeNull()
  })

  it('shows "Aega jäänud" label by default', () => {
    const endsAt = new Date('2026-08-30T12:00:00Z')
    render(<Countdown endsAt={endsAt} />)
    expect(screen.getByText('Aega jäänud')).toBeDefined()
  })

  it('accepts string date input', () => {
    render(<Countdown endsAt="2026-08-30T12:00:00Z" />)
    expect(screen.getByText(/3p 0h 0m 0s/)).toBeDefined()
  })

  it('accepts Date object input', () => {
    render(<Countdown endsAt={new Date('2026-08-30T12:00:00Z')} />)
    expect(screen.getByText(/3p 0h 0m 0s/)).toBeDefined()
  })

  it('updates every second', () => {
    const endsAt = new Date('2026-08-27T12:00:03Z')
    render(<Countdown endsAt={endsAt} />)

    expect(screen.getByText(/3s/)).toBeDefined()

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(screen.getByText(/2s/)).toBeDefined()
  })
})
