'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState, useTransition } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'

import { kanbanColumns } from './lead-flow'
import { moveLeadStatusAction } from '../../../_actions/ops'
import { EllipsisIcon, ExternalLinkIcon } from '../../../_components/icons'
import { useEscapeKey } from '../../../_components/ui/useOverlay'

export interface KanbanCardView {
  id: string
  contactName: string
  formName: string
  cadastr: string | null
  status: string
  assignedSpecialistId: string | null
  assignedSpecialistName: string | null
  sla: { level: 'amber' | 'red'; label: string } | null
  nextActionAt: string | null
  duplicateOfId: string | null
  mine: boolean
}

interface PendingInput {
  leadId: string
  to: string
  from: string
  kind: 'qualified' | 'disqualified'
}

interface CardMenuState {
  leadId: string
  top: number
  left: number
}

const MENU_WIDTH = 224
const MENU_GAP = 6
const MENU_EDGE = 8

const chipClass =
  'rounded-pill border border-border bg-bg-mist px-2 py-0.5 text-label text-ink-muted'
const menuItemClass =
  'flex w-full items-center gap-2 rounded-input px-2.5 py-2 text-left text-bodySm text-ink transition-colors duration-hover ease-hover hover:bg-bg-mist hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'

const slaBadgeClass = (level: 'amber' | 'red') =>
  level === 'red'
    ? 'bg-danger-light text-danger'
    : 'bg-info-light text-info'

const shortLeadId = (id: string) => `#${id.slice(0, 8)}`

function specialistInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join('') || '?'
  )
}

export function LeadsKanban({ cards }: { cards: KanbanCardView[] }) {
  const router = useRouter()
  const [board, setBoard] = useState(cards)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [pendingInput, setPendingInput] = useState<PendingInput | null>(null)
  const [noteText, setNoteText] = useState('')
  const [pending, startTransition] = useTransition()
  const [menu, setMenu] = useState<CardMenuState | null>(null)
  const menuListRef = useRef<HTMLDivElement | null>(null)
  const menuReturnFocusRef = useRef<HTMLElement | null>(null)
  const noteHeadingId = useId()

  useEffect(() => {
    setBoard(cards)
  }, [cards])

  const menuCard = menu ? board.find((card) => card.id === menu.leadId) ?? null : null

  function closeCardMenu(restoreFocus = true) {
    if (!menu) return
    setMenu(null)
    if (restoreFocus) menuReturnFocusRef.current?.focus()
    menuReturnFocusRef.current = null
  }

  // Escape closes via the shared overlay stack, restoring focus to the card.
  useEscapeKey(menu !== null, () => { closeCardMenu(); })

  // Click outside closes the card menu without stealing focus.
  useEffect(() => {
    if (!menu) return
    function handlePointerDown(event: PointerEvent) {
      const list = menuListRef.current
      if (list && !list.contains(event.target as Node)) setMenu(null)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => { document.removeEventListener('pointerdown', handlePointerDown); }
  }, [menu])

  // Menus open with focus on the first item, per the menu keyboard contract.
  useEffect(() => {
    if (!menu) return
    menuListRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
  }, [menu])

  function openCardMenu(leadId: string, trigger: HTMLElement) {
    if (pending) return
    const rect = trigger.getBoundingClientRect()
    const left = Math.max(
      MENU_EDGE,
      Math.min(rect.left, window.innerWidth - MENU_WIDTH - MENU_EDGE),
    )
    menuReturnFocusRef.current = trigger
    setMenu({ leadId, top: rect.bottom + MENU_GAP, left })
  }

  function handleCardKeyDown(event: ReactKeyboardEvent<HTMLElement>, leadId: string) {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
      event.preventDefault()
      openCardMenu(leadId, event.currentTarget)
    }
  }

  function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const list = menuListRef.current
    if (!list) return
    const items = Array.from(list.querySelectorAll<HTMLElement>('[role="menuitem"]'))
    if (items.length === 0) return
    const index = items.indexOf(document.activeElement as HTMLElement)
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      items[(index + 1) % items.length]?.focus()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      items[(index - 1 + items.length) % items.length]?.focus()
    } else if (event.key === 'Home') {
      event.preventDefault()
      items[0]?.focus()
    } else if (event.key === 'End') {
      event.preventDefault()
      items[items.length - 1]?.focus()
    }
  }

  function attemptMove(leadId: string, to: string, note?: string) {
    const current = board.find((card) => card.id === leadId)
    if (!current || current.status === to) return

    setError(null)
    if ((to === 'qualified' || to === 'disqualified') && note === undefined) {
      setPendingInput({ leadId, to, from: current.status, kind: to })
      setNoteText('')
      return
    }
    // Optimistic move; the action layer enforces the same guards and the
    // board reverts on rejection.
    setBoard((prev) =>
      prev.map((card) => (card.id === leadId ? { ...card, status: to } : card)),
    )
    startTransition(async () => {
      const result = await moveLeadStatusAction({
        leadId,
        status: to,
        ...(note !== undefined ? { note } : {}),
      })
      if (!result.ok) {
        setBoard((prev) =>
          prev.map((card) => (card.id === leadId ? { ...card, status: current.status } : card)),
        )
        setError(result.error ?? 'Oleku muutmine ebaõnnestus.')
        return
      }
      router.refresh()
    })
  }

  function submitNote() {
    if (!pendingInput) return
    const { leadId, to, kind } = pendingInput
    if (noteText.trim().length < 5) {
      setError(kind === 'qualified'
        ? 'Kvalifitseerimise märkus on kohustuslik (vähemalt 5 tähemärki).'
        : 'Tagasilükkamise põhjus on kohustuslik (vähemalt 5 tähemärki).')
      return
    }
    setPendingInput(null)
    attemptMove(leadId, to, noteText.trim())
  }

  return (
    <div>
      <div aria-live="polite">
        {error ? (
          <div
            role="alert"
            className="mb-sm rounded-input border border-danger bg-danger-light px-md py-sm text-bodySm text-danger"
          >
            {error}
          </div>
        ) : null}
      </div>
      <div className="flex snap-x gap-sm overflow-x-auto pb-sm md:grid md:grid-cols-3 md:pb-0 xl:grid-cols-5">
        {kanbanColumns.map((column) => {
          const columnCards = board.filter((card) => card.status === column.status)
          const isTarget = dragOver === column.status
          return (
            <section
              key={column.status}
              onDragOver={(event) => {
                event.preventDefault()
                setDragOver(column.status)
              }}
              onDragLeave={() => {
                setDragOver(null)
              }}
              onDrop={(event) => {
                event.preventDefault()
                setDragOver(null)
                const leadId = event.dataTransfer.getData('text/plain')
                if (leadId) attemptMove(leadId, column.status)
              }}
              className={`min-h-40 w-72 flex-none snap-start rounded-card border p-sm transition-colors duration-hover ease-hover md:w-auto ${
                isTarget ? 'border-primary bg-bgPage' : 'border-border bg-bg-mist'
              }`}
            >
              <header className="mb-xs flex items-center justify-between gap-xs">
                <h3 className="text-label font-semibold text-ink">{column.label}</h3>
                <span className="rounded-pill bg-bgPage px-2 py-0.5 text-label text-ink-muted">
                  {String(columnCards.length)}
                </span>
              </header>
              {column.hint ? (
                <p className="mb-xs text-bodySm text-ink-muted">{column.hint}</p>
              ) : null}
              <ul className="space-y-xs">
                {columnCards.map((card) => (
                  <li key={card.id}>
                    <div
                      role="group"
                      aria-label={`Juhtlõige ${shortLeadId(card.id)} ${card.contactName}. Enter avab teisaldamise menüü.`}
                      tabIndex={0}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData('text/plain', card.id)
                        event.dataTransfer.effectAllowed = 'move'
                      }}
                      onKeyDown={(event) => { handleCardKeyDown(event, card.id); }}
                      className={`flex cursor-grab flex-col gap-1.5 rounded-input border bg-bgPage p-xs transition-colors duration-hover ease-hover hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                        card.mine ? 'border-primary' : 'border-border'
                      } ${pending ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-xs">
                        <span className="min-w-0">
                          <Link
                            href={`/admin/leads/${card.id}`}
                            className="text-bodySm font-semibold text-ink hover:text-primary"
                          >
                            {card.contactName}
                          </Link>
                          <span className="block font-mono text-label text-ink-muted">
                            {shortLeadId(card.id)}
                          </span>
                        </span>
                        <button
                          type="button"
                          aria-haspopup="menu"
                          aria-expanded={menu?.leadId === card.id}
                          aria-label={`Juhtlõime ${card.contactName} tegevused`}
                          disabled={pending}
                          onClick={(event) => {
                            event.stopPropagation()
                            if (menu?.leadId === card.id) {
                              closeCardMenu()
                            } else {
                              openCardMenu(card.id, event.currentTarget)
                            }
                          }}
                          className="grid h-6 w-6 flex-none place-items-center rounded-input text-ink-muted transition-colors duration-hover ease-hover hover:bg-bg-mist hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          <EllipsisIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {card.cadastr ? (
                          <span className={chipClass} title="Katastritunnus">
                            {card.cadastr}
                          </span>
                        ) : null}
                        <span className={chipClass}>{card.formName}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        {card.sla ? (
                          <span
                            className={`rounded-pill px-2 py-0.5 text-label font-semibold ${slaBadgeClass(card.sla.level)}`}
                          >
                            {card.sla.label}
                          </span>
                        ) : null}
                        {card.nextActionAt ? (
                          <span className="text-bodySm text-info">
                            Järgmine tegevus: {card.nextActionAt}
                          </span>
                        ) : null}
                        {card.assignedSpecialistName ? (
                          <span
                            title={card.assignedSpecialistName}
                            className="ml-auto grid h-6 w-6 flex-none place-items-center rounded-full bg-primary-light text-label font-semibold text-primary"
                          >
                            {specialistInitials(card.assignedSpecialistName)}
                          </span>
                        ) : (
                          <span className="ml-auto rounded-pill bg-danger-light px-2 py-0.5 text-label font-semibold text-danger">
                            määramata
                          </span>
                        )}
                      </div>
                      {card.duplicateOfId ? (
                        <p className="text-bodySm text-info">
                          võimalik duplikaat{' '}
                          <Link className="underline" href={`/admin/leads/${card.duplicateOfId}`}>
                            {shortLeadId(card.duplicateOfId)}
                          </Link>
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
                {columnCards.length === 0 ? (
                  <li className="px-1 py-xs text-bodySm text-ink-muted">—</li>
                ) : null}
              </ul>
            </section>
          )
        })}
      </div>

      {menu && menuCard ? (
        <div
          ref={menuListRef}
          role="menu"
          aria-label="Liiguta juhtlõige teise etappi"
          onKeyDown={handleMenuKeyDown}
          style={{ top: menu.top, left: menu.left }}
          className="fixed z-50 min-w-52 rounded-input border border-border bg-bgPage p-1.5 shadow-modal"
        >
          <p className="px-2.5 pb-1 pt-1 font-heading text-label font-bold uppercase tracking-wider text-ink-muted">
            Liiguta →
          </p>
          {kanbanColumns
            .filter((target) => target.status !== menuCard.status)
            .map((target) => (
              <button
                key={target.status}
                type="button"
                role="menuitem"
                onClick={() => {
                  closeCardMenu()
                  attemptMove(menu.leadId, target.status)
                }}
                className={menuItemClass}
              >
                {target.label}
              </button>
            ))}
          <div className="mx-1 my-1 border-t border-border" />
          <Link role="menuitem" href={`/admin/leads/${menu.leadId}`} className={menuItemClass}>
            <ExternalLinkIcon className="h-3.5 w-3.5 text-ink-muted" />
            Ava detailvaade
          </Link>
        </div>
      ) : null}

      {pendingInput ? (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby={noteHeadingId}
          className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-container-sm rounded-card border border-border bg-bgPage p-md shadow-lg"
        >
          <h4 id={noteHeadingId} className="mb-xs font-heading text-h4 font-bold text-ink">
            {pendingInput.kind === 'qualified' ? 'Kvalifitseerimise märkus' : 'Tagasilükkamise põhjus'}
          </h4>
          <p className="mb-xs text-bodySm text-ink-muted">
            Kirje liikumiseks „{pendingInput.kind === 'qualified' ? 'Kvalifitseeritud' : 'Mittekvalifitseeritud'}“
            on tekst kohustuslik.
          </p>
          <textarea
            aria-labelledby={noteHeadingId}
            className="h-20 w-full rounded-input border border-border bg-bgPage px-3 py-2 text-bodySm text-ink outline-none focus:border-primary"
            value={noteText}
            onChange={(event) => {
              setNoteText(event.target.value)
            }}
            autoFocus
          />
          <div className="mt-xs flex items-center gap-sm">
            <button
              type="button"
              className="inline-flex h-10 items-center rounded-button bg-primary px-4 text-label font-semibold text-ink-inverse hover:bg-primaryHover"
              onClick={submitNote}
            >
              Kinnita
            </button>
            <button
              type="button"
              className="inline-flex h-10 items-center rounded-button border border-border bg-bgPage px-4 text-label font-semibold text-ink hover:border-primary hover:text-primary"
              onClick={() => {
                setPendingInput(null)
              }}
            >
              Tühista
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
