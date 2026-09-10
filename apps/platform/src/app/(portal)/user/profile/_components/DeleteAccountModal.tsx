'use client'

import { Btn, Modal } from '@erametsad/ui'
import { Archive, Trash2 } from 'lucide-react'
import { useState } from 'react'

interface DeleteAccountModalProps {
  isOpen: boolean
  onClose: () => void
}

// Demo delete modal (12-user-profile): the Kustutame/Säilitame lists and the
// 7-year retention note render before the confirm action. No portal endpoint
// records a self-service deletion request yet, so confirm surfaces the
// interim channel instead of pretending the request was filed.
export function DeleteAccountModal({
  isOpen,
  onClose,
}: DeleteAccountModalProps) {
  const [submitted, setSubmitted] = useState(false)

  function handleClose() {
    onClose()
    setSubmitted(false)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Kustuta konto?"
      size="md"
    >
      <div className="flex flex-col gap-sm">
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

        {submitted && (
          <p role="status" className="m-0 text-bodySm text-inkMuted">
            Iseteeninduslik kustutustaotlus pole veel avatud. Esita taotlus toe
            kaudu.
          </p>
        )}

        <div className="mt-1 flex flex-wrap justify-end gap-xs">
          <Btn variant="ghost" type="button" onClick={handleClose}>
            Katkesta
          </Btn>
          <button
            type="button"
            onClick={() => {
              setSubmitted(true)
            }}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-button border border-danger bg-transparent px-4 font-label text-label font-semibold text-danger transition-colors duration-hover ease-hover hover:bg-dangerLight motion-reduce:transition-none"
          >
            <Trash2 size={16} aria-hidden="true" />
            Jätka kustutamist
          </button>
        </div>
      </div>
    </Modal>
  )
}
