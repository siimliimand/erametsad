'use client'

import { useEffect, useRef, useState } from 'react'

import {
  deleteMaintenanceWindowAction,
  listMaintenanceWindowsAction,
  saveMaintenanceWindowAction,
  setMaintenanceModeAction,
  type MaintenanceConflict,
  type MaintenanceWindowRow,
} from '../../../_actions/settings'
import { TriangleAlertIcon } from '../../../_components/icons'
import { Modal } from '../../../_components/ui/Modal'
import { Switch } from '../../../_components/ui/Switch'

/**
 * Maintenance mode row for the Platvorm section (demo 13-settings):
 * enabling opens the danger modal with the typed HOOLDUS confirm word,
 * disabling submits directly (maintenance.end has no modal in the demo).
 */
export function MaintenanceMode({ enabled }: { enabled: boolean }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmWord, setConfirmWord] = useState('')
  const [reason, setReason] = useState('')
  const disableFormRef = useRef<HTMLFormElement>(null)

  const confirmReady =
    confirmWord.trim().toUpperCase() === 'HOOLDUS' && reason.trim().length >= 5

  return (
    <>
      <div className="border-b border-border last:border-b-0">
      <div className="space-y-sm px-md py-sm">
        <div className="flex items-center gap-sm">
          <Switch
            checked={enabled}
            label="Hooldusrežiim"
            onChange={(next) => {
              if (next) {
                setConfirmWord('')
                setReason('')
                setModalOpen(true)
              } else {
                disableFormRef.current?.requestSubmit()
              }
            }}
          />
          <span className="text-bodySm font-medium text-ink">Hooldusrežiim</span>
          {enabled ? (
            <span className="text-label font-semibold text-danger">
              Aktiivne — avalik portaal on külastajatele suletud.
            </span>
          ) : null}
        </div>
        <p className="flex items-start gap-xs rounded-card bg-dangerLight px-sm py-xs text-label font-medium text-danger">
          <TriangleAlertIcon aria-hidden="true" className="mt-px h-4 w-4 shrink-0" />
          Hooldusrežiim sulgeb avaliku portaali külastajatele. Sisselülitamiseks tuleb trükkida
          kinnitussõna.
        </p>
      </div>

      <form ref={disableFormRef} action={setMaintenanceModeAction} hidden>
        <input type="hidden" name="enabled" value="false" />
      </form>

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
        }}
        title="Lülita hooldusrežiim sisse?"
        tone="danger"
        icon={<TriangleAlertIcon className="h-[18px] w-[18px]" />}
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setModalOpen(false)
              }}
              className="inline-flex h-9 items-center rounded-input border border-border bg-bgPage px-3.5 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:border-primary hover:text-primary"
            >
              Tühista
            </button>
            <button
              type="submit"
              form="maintenance-enable-form"
              disabled={!confirmReady}
              className="inline-flex h-9 items-center gap-xs rounded-button bg-danger px-3.5 text-label font-semibold text-inkInverse transition-[filter] duration-hover ease-hover hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <TriangleAlertIcon aria-hidden="true" className="h-4 w-4" />
              Lülita sisse
            </button>
          </>
        }
      >
        <form id="maintenance-enable-form" action={setMaintenanceModeAction}>
          <input type="hidden" name="enabled" value="true" />
          <p className="text-bodySm text-inkMuted">
            Avalik portaal sulgub külastajatele kohe. Käimasolevad oksjonid jätkuvad, kuid uusi
            pakkumisi ei võeta vastu. Tegevus logitakse auditilogisse.
          </p>
          <div className="flex flex-col gap-1">
            <label htmlFor="maintenance-confirm" className="text-label font-semibold text-ink">
              Trüki kinnitussõna: HOOLDUS
            </label>
            <input
              id="maintenance-confirm"
              name="confirm"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={confirmWord}
              onChange={(event) => {
                setConfirmWord(event.target.value)
              }}
              className="h-10 w-full rounded-input border border-border bg-bgPage px-3 text-bodySm text-ink outline-none transition-colors duration-hover ease-hover focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="maintenance-reason" className="text-label font-semibold text-ink">
              Põhjendus (kohustuslik)
            </label>
            <textarea
              id="maintenance-reason"
              name="reason"
              rows={2}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value)
              }}
              className="w-full rounded-input border border-border bg-bgPage px-3 py-2 text-bodySm text-ink outline-none transition-colors duration-hover ease-hover focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </form>
      </Modal>
      </div>
      <MaintenanceWindows />
    </>
  )
}

const maintenanceScopeLabels: Record<string, string> = {
  portal: 'Portaal',
  admin: 'Haldusliides',
  all: 'Kõik',
}

const windowInputClass =
  'h-10 w-full rounded-input border border-border bg-bgPage px-3 text-bodySm text-ink outline-none transition-colors duration-hover ease-hover focus:border-primary focus:ring-2 focus:ring-primary/20'

function formatWindowTime(iso: string): string {
  return new Date(iso).toLocaleString('et-EE', { dateStyle: 'short', timeStyle: 'short' })
}

/**
 * "Aknad" (task 4.4): planned maintenance windows with a "Lisa aken" form.
 * The server action blocks a window that contains an auction end and
 * returns the conflicting auctions; saving through the conflict requires
 * the force checkbox plus a second explicit confirmation.
 */
function MaintenanceWindows() {
  const [rows, setRows] = useState<MaintenanceWindowRow[] | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [scope, setScope] = useState('portal')
  const [note, setNote] = useState('')
  const [reason, setReason] = useState('')
  const [conflicts, setConflicts] = useState<MaintenanceConflict[] | null>(null)
  const [force, setForce] = useState(false)
  const [confirmConflict, setConfirmConflict] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<MaintenanceWindowRow | null>(null)
  const [deleteReason, setDeleteReason] = useState('')

  useEffect(() => {
    let cancelled = false
    void listMaintenanceWindowsAction().then((loaded) => {
      if (!cancelled) setRows(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [])

  function reload(): Promise<void> {
    return listMaintenanceWindowsAction().then((loaded) => {
      setRows(loaded)
    })
  }

  function resetForm(): void {
    setStartsAt('')
    setEndsAt('')
    setScope('portal')
    setNote('')
    setReason('')
    setConflicts(null)
    setForce(false)
    setConfirmConflict(false)
  }

  function submit(forceSave: boolean): void {
    if (busy) return
    setBusy(true)
    void saveMaintenanceWindowAction({ startsAt, endsAt, scope, note, reason, force: forceSave })
      .then(async (result) => {
        if (result.ok) {
          resetForm()
          setFormOpen(false)
          setMessage({ tone: 'ok', text: 'Hooldusaken salvestatud.' })
          await reload()
        } else if ('conflict' in result) {
          setConflicts(result.conflicts)
          setForce(false)
          setConfirmConflict(false)
          setMessage(null)
        } else if ('error' in result) {
          setMessage({ tone: 'error', text: result.error })
        }
      })
      .finally(() => {
        setBusy(false)
      })
  }

  return (
    <div className="space-y-sm border-b border-border px-md py-sm">
      <div className="flex items-center justify-between gap-sm">
        <h3 className="text-label font-semibold text-ink">Aknad</h3>
        <button
          type="button"
          onClick={() => {
            resetForm()
            setFormOpen(!formOpen)
          }}
          className="inline-flex h-8 items-center rounded-input border border-border bg-bgPage px-3 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:border-primary hover:text-primary"
        >
          Lisa aken
        </button>
      </div>

      {message ? (
        <p
          role="status"
          className={`rounded-card px-sm py-xs text-label font-medium ${
            message.tone === 'ok' ? 'bg-infoLight text-info' : 'bg-dangerLight text-danger'
          }`}
        >
          {message.text}
        </p>
      ) : null}

      {formOpen ? (
        <form
          className="space-y-sm rounded-card border border-border px-sm py-sm"
          onSubmit={(event) => {
            event.preventDefault()
            submit(false)
          }}
        >
          <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-label font-semibold text-ink">Algus</span>
              <input
                type="datetime-local"
                required
                value={startsAt}
                onChange={(event) => {
                  setStartsAt(event.target.value)
                }}
                className={windowInputClass}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-label font-semibold text-ink">Lõpp</span>
              <input
                type="datetime-local"
                required
                value={endsAt}
                onChange={(event) => {
                  setEndsAt(event.target.value)
                }}
                className={windowInputClass}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-label font-semibold text-ink">Ulatus</span>
              <select
                value={scope}
                onChange={(event) => {
                  setScope(event.target.value)
                }}
                className={windowInputClass}
              >
                {Object.entries(maintenanceScopeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-label font-semibold text-ink">Märkus</span>
              <input
                type="text"
                value={note}
                onChange={(event) => {
                  setNote(event.target.value)
                }}
                className={windowInputClass}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-label font-semibold text-ink">Põhjendus (kohustuslik)</span>
            <textarea
              rows={2}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value)
              }}
              className="w-full rounded-input border border-border bg-bgPage px-3 py-2 text-bodySm text-ink outline-none transition-colors duration-hover ease-hover focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>

          {conflicts && conflicts.length > 0 ? (
            <div className="rounded-card bg-dangerLight px-sm py-xs">
              <p className="flex items-start gap-xs text-label font-semibold text-danger">
                <TriangleAlertIcon aria-hidden="true" className="mt-px h-4 w-4 shrink-0" />
                Aken kattub oksjoni lõpuajaga. Salvestamine on keelatud ilma kinnituseta:
              </p>
              <ul className="mt-xs list-disc pl-5 text-label text-danger">
                {conflicts.map((conflict) => (
                  <li key={conflict.id}>
                    {conflict.title} — lõpeb {formatWindowTime(conflict.endsAt)} ({conflict.status})
                  </li>
                ))}
              </ul>
              <div className="mt-xs flex flex-col gap-1">
                <label className="flex items-center gap-xs text-label text-ink">
                  <input
                    type="checkbox"
                    checked={force}
                    onChange={(event) => {
                      setForce(event.target.checked)
                    }}
                  />
                  Jätkan konflikti teadlikult (sunni salvestamist)
                </label>
                <label className="flex items-center gap-xs text-label text-ink">
                  <input
                    type="checkbox"
                    checked={confirmConflict}
                    onChange={(event) => {
                      setConfirmConflict(event.target.checked)
                    }}
                  />
                  Kinnitan veel kord, et oksjonid võivad hoolduse ajal lõppeda
                </label>
              </div>
              <button
                type="button"
                disabled={busy || !force || !confirmConflict}
                className="mt-xs inline-flex h-8 items-center rounded-input bg-danger px-3 text-label font-semibold text-inkInverse disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => {
                  submit(true)
                }}
              >
                Salvesta siiski
              </button>
            </div>
          ) : null}

          <div className="flex items-center gap-xs">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-9 items-center rounded-button bg-primary px-3.5 text-label font-semibold text-inkInverse transition-[filter] duration-hover ease-hover hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Salvesta aken
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center rounded-input border border-border bg-bgPage px-3.5 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:border-primary hover:text-primary"
              onClick={() => {
                setFormOpen(false)
              }}
            >
              Tühista
            </button>
          </div>
        </form>
      ) : null}

      {deleteTarget ? (
        <div className="rounded-card border border-danger bg-dangerLight px-sm py-xs">
          <p className="text-label font-semibold text-danger">
            Kustutada aken {formatWindowTime(deleteTarget.startsAt)} –{' '}
            {formatWindowTime(deleteTarget.endsAt)}?
          </p>
          <div className="mt-xs flex flex-wrap items-center gap-xs">
            <input
              type="text"
              value={deleteReason}
              onChange={(event) => {
                setDeleteReason(event.target.value)
              }}
              placeholder="Kustutamise põhjendus"
              aria-label="Kustutamise põhjendus"
              className="h-8 w-64 rounded-input border border-border bg-bgPage px-2 text-label text-ink outline-none focus:border-primary"
            />
            <button
              type="button"
              disabled={busy}
              className="inline-flex h-8 items-center rounded-input bg-danger px-3 text-label font-semibold text-inkInverse disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => {
                if (busy) return
                setBusy(true)
                void deleteMaintenanceWindowAction(deleteTarget.id, deleteReason)
                  .then(async (result) => {
                    if (result.ok) {
                      setDeleteTarget(null)
                      setMessage({ tone: 'ok', text: 'Hooldusaken kustutati.' })
                      await reload()
                    } else {
                      setMessage({ tone: 'error', text: result.error ?? 'Kustutamine ebaõnnestus.' })
                    }
                  })
                  .finally(() => {
                    setBusy(false)
                  })
              }}
            >
              Kinnita kustutus
            </button>
            <button
              type="button"
              className="inline-flex h-8 items-center rounded-input border border-border bg-bgPage px-3 text-label font-semibold text-ink hover:border-primary hover:text-primary"
              onClick={() => {
                setDeleteTarget(null)
              }}
            >
              Tühista
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-card border border-border">
        <table className="w-full text-left text-bodySm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-sm py-xs text-label font-semibold text-inkMuted">Algus</th>
              <th className="px-sm py-xs text-label font-semibold text-inkMuted">Lõpp</th>
              <th className="px-sm py-xs text-label font-semibold text-inkMuted">Ulatus</th>
              <th className="px-sm py-xs text-label font-semibold text-inkMuted">Märkus</th>
              <th className="px-sm py-xs text-label font-semibold text-inkMuted">
                <span className="sr-only">Toimingud</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <tr>
                <td colSpan={5} className="px-sm py-sm text-inkMuted">
                  Laadimine …
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-sm py-sm text-inkMuted">
                  Hooldusaknaid pole planeeritud.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-b-0">
                  <td className="px-sm py-xs text-ink">{formatWindowTime(row.startsAt)}</td>
                  <td className="px-sm py-xs text-ink">{formatWindowTime(row.endsAt)}</td>
                  <td className="px-sm py-xs text-ink">{maintenanceScopeLabels[row.scope] ?? row.scope}</td>
                  <td className="px-sm py-xs text-inkMuted">{row.note ?? '—'}</td>
                  <td className="px-sm py-xs">
                    <button
                      type="button"
                      className="inline-flex h-8 items-center rounded-input border border-border bg-bgPage px-3 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:border-danger hover:text-danger"
                      onClick={() => {
                        setDeleteTarget(row)
                        setDeleteReason('')
                      }}
                    >
                      Kustuta
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
