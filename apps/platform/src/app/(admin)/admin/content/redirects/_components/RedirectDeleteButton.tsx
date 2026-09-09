'use client'

import { useState } from 'react'

import { deleteRedirectAction } from '../../../../_actions/content'
import { ConfirmDialog } from '../../../../_components/ui/ConfirmDialog'

/**
 * Reason-guarded delete (task 3.5): the server action rejects anything
 * shorter than five characters, and the dialog blocks the submit until the
 * typed reason qualifies.
 */
export function RedirectDeleteButton({ id, from }: { id: string; from: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true)
        }}
        className="text-label font-semibold text-danger transition-colors duration-hover ease-hover hover:text-danger/80"
      >
        Kustuta
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => {
          setOpen(false)
        }}
        title={`Kustuta suunamine ${from}`}
        description="Kustutatud suunamist ei saa taastata; sündmust jääb ainult auditlogi."
        confirmLabel="Kustuta"
        variant="reason"
        reasonLabel="Kustutamise põhjus"
        reasonPlaceholder="Näiteks: leht on tagasi tulemas"
        onConfirm={(reason) => {
          const data = new FormData()
          data.set('id', id)
          data.set('reason', reason)
          void deleteRedirectAction(data)
          setOpen(false)
        }}
      />
    </>
  )
}
