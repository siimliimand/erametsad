'use client'

import { useRef, useState } from 'react'

import { setMaintenanceModeAction } from '../../../_actions/settings'
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
  )
}
