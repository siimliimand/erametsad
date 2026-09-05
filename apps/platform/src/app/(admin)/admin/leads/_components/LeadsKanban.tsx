'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'

import { kanbanColumns } from './lead-flow'
import { moveLeadStatusAction } from '../../../_actions/ops'

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

const slaBadgeClass = (level: 'amber' | 'red') =>
  level === 'red'
    ? 'bg-danger-light text-danger'
    : 'bg-info-light text-info'

export function LeadsKanban({ cards }: { cards: KanbanCardView[] }) {
  const router = useRouter()
  const [board, setBoard] = useState(cards)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [pendingInput, setPendingInput] = useState<PendingInput | null>(null)
  const [noteText, setNoteText] = useState('')
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    setBoard(cards)
  }, [cards])

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
      <div className="grid grid-cols-1 gap-sm overflow-x-auto md:grid-cols-3 xl:grid-cols-5">
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
              className={`min-h-40 rounded-card border p-sm transition-colors duration-hover ease-hover ${
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
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData('text/plain', card.id)
                        event.dataTransfer.effectAllowed = 'move'
                      }}
                      className={`rounded-input border bg-bgPage p-xs ${
                        card.mine ? 'border-primary' : 'border-border'
                      } ${pending ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-xs">
                        <Link
                          href={`/admin/leads/${card.id}`}
                          className="text-bodySm font-semibold text-ink hover:text-primary"
                        >
                          {card.contactName}
                        </Link>
                        {card.sla ? (
                          <span
                            className={`rounded-pill px-2 py-0.5 text-label font-semibold ${slaBadgeClass(card.sla.level)}`}
                          >
                            {card.sla.label}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-bodySm text-ink-muted">
                        {card.formName}
                        {card.assignedSpecialistName
                          ? ` · ${card.assignedSpecialistName}`
                          : ' · määramata'}
                      </p>
                      {card.nextActionAt ? (
                        <p className="text-bodySm text-info">
                          Järgmine tegevus: {card.nextActionAt}
                        </p>
                      ) : null}
                      {card.duplicateOfId ? (
                        <p className="text-bodySm text-info">
                          võimalik duplikaat{' '}
                          <Link className="underline" href={`/admin/leads/${card.duplicateOfId}`}>
                            #{card.duplicateOfId.slice(0, 8)}
                          </Link>
                        </p>
                      ) : null}
                      <label className="mt-xs block">
                        <span className="sr-only">Liiguta {card.contactName}</span>
                        <select
                          className="h-7 w-full rounded-input border border-border bg-bgPage px-1 text-bodySm text-ink"
                          value=""
                          disabled={pending}
                          onChange={(event) => {
                            if (event.target.value) attemptMove(card.id, event.target.value)
                          }}                        >
                          <option value="">Liiguta →</option>
                          {kanbanColumns.map((target) => (
                            <option key={target.status} value={target.status}>
                              {target.label}
                            </option>
                          ))}
                        </select>
                      </label>
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

      {pendingInput ? (
        <div
          role="dialog"
          aria-modal="false"
          className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-container-sm rounded-card border border-border bg-bgPage p-md shadow-lg"
        >
          <h4 className="mb-xs font-heading text-h4 font-bold text-ink">
            {pendingInput.kind === 'qualified' ? 'Kvalifitseerimise märkus' : 'Tagasilükkamise põhjus'}
          </h4>
          <p className="mb-xs text-bodySm text-ink-muted">
            Kirje liikumiseks „{pendingInput.kind === 'qualified' ? 'Kvalifitseeritud' : 'Mittekvalifitseeritud'}“
            on tekst kohustuslik.
          </p>
          <textarea
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
