'use client'

import { Btn, FormInput, Modal } from '@erametsad/ui'
import { Archive, Trash2 } from 'lucide-react'
import { useState, type SyntheticEvent } from 'react'

import { ApiError, requestJson } from './api'

interface DeleteAccountModalProps {
  isOpen: boolean
  onClose: () => void
}

// D7: the Kustutame/Säilitame lists and the 7-year retention note are the
// copy of record for what is deleted versus kept — the endpoint below
// anonymizes the account (personal fields die, bid/contract rows survive
// for the retention period), revokes every session and audits the request.
export function DeleteAccountModal({
  isOpen,
  onClose,
}: DeleteAccountModalProps) {
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleClose() {
    onClose()
    setConfirmation('')
    setError(null)
    setBusy(false)
  }

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    if (confirmation !== 'KUSTUTA') {
      setError('Kinnituseks kirjuta KUSTUTA')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await requestJson('/api/v1/my/delete-account', {
        method: 'POST',
        body: JSON.stringify({ confirmation }),
      })
      // The account is anonymized and the server cleared the session
      // cookies on the response; a full navigation lands signed out.
      window.location.assign('/')
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Konto kustutamine ebaõnnestus. Proovige uuesti.',
      )
      setBusy(false)
    }
  }

  const confirmed = confirmation === 'KUSTUTA'

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Kustuta konto?"
      size="md"
    >
      <form onSubmit={(event) => {
        void handleSubmit(event)
      }} className="flex flex-col gap-sm" noValidate>
        <p className="m-0 text-bodySm text-inkMuted">
          See toiming mõjutab kogu kontot kõigis profiilides.
        </p>

        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          <li className="flex items-start gap-2.5 text-bodySm text-ink">
            <Trash2
              size={14}
              aria-hidden="true"
              className="mt-1 shrink-0 text-danger"
            />
            <span>
              Kustutame: konto ja profiilid, teavituste tellimused, oksjonilood
              ja mustandid.
            </span>
          </li>
          <li className="flex items-start gap-2.5 text-bodySm text-ink">
            <Archive
              size={14}
              aria-hidden="true"
              className="mt-1 shrink-0 text-primary"
            />
            <span>
              Säilitame: lõppenud oksjonite pakkumised ja sõlmitud lepingud.
            </span>
          </li>
        </ul>

        <p className="m-0 rounded-button bg-dangerLight p-3 text-bodySm text-ink">
          <strong className="font-semibold text-danger">7 aastat.</strong>{' '}
          Raamatupidamisõiguse alusel säilitame pakkumised ja lepingud 7 aastat
          anonüümseult. Isikuandmeid ei ole selleks ajaks võimalik taastada.
        </p>

        <FormInput
          label="Kinnitage konto kustutamine"
          name="confirmation"
          type="text"
          autoComplete="off"
          required
          hint="Kirjuta kinnituseks KUSTUTA"
          value={confirmation}
          disabled={busy}
          onChange={(event) => {
            setConfirmation(event.target.value)
          }}
        />

        {error !== null && (
          <p role="alert" className="m-0 text-bodySm text-danger">
            {error}
          </p>
        )}

        <div className="mt-1 flex flex-wrap justify-end gap-xs">
          <Btn variant="ghost" type="button" onClick={handleClose} disabled={busy}>
            Katkesta
          </Btn>
          <button
            type="submit"
            disabled={!confirmed || busy}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-button border border-danger bg-transparent px-4 font-label text-label font-semibold text-danger transition-colors duration-hover ease-hover hover:bg-dangerLight disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
          >
            <Trash2 size={16} aria-hidden="true" />
            Jätka kustutamist
          </button>
        </div>
      </form>
    </Modal>
  )
}
