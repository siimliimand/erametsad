'use client'

import { Btn, FormInput, Modal } from '@eametsad/ui'
import { useRouter } from 'next/navigation'
import { useState, type SyntheticEvent } from 'react'

import { ApiError, requestJson } from './api'

interface PasswordModalProps {
  isOpen: boolean
  onClose: () => void
}

export function PasswordModal({ isOpen, onClose }: PasswordModalProps) {
  const router = useRouter()
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setOldPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setError(null)
    setDone(false)
  }

  function handleClose() {
    onClose()
    reset()
  }

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    if (newPassword.length < 10) {
      setError('Parool peab olema vähemalt 10 tähemärki.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Paroolid ei kattu.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await requestJson<{ message: string }>('/api/v1/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ oldPassword, newPassword }),
      })
      setDone(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Parooli vahetamine ebaõnnestus.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Muuda parooli" size="sm">
      {done ? (
        <div className="flex flex-col gap-sm">
          <p className="text-bodySm text-ink">
            Parool on muudetud. Palun logige kõikides seadmetes uuesti sisse.
          </p>
          <Btn
            onClick={() => {
              router.push('/login')
            }}
          >
            Logi sisse
          </Btn>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            void handleSubmit(event)
          }}
          className="flex flex-col gap-sm"
          noValidate
        >
          <FormInput
            label="Praegune parool"
            name="oldPassword"
            type="password"
            autoComplete="current-password"
            required
            value={oldPassword}
            disabled={busy}
            onChange={(event) => {
              setOldPassword(event.target.value)
            }}
          />
          <FormInput
            label="Uus parool"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            hint="Vähemalt 10 tähemärki."
            value={newPassword}
            disabled={busy}
            onChange={(event) => {
              setNewPassword(event.target.value)
            }}
          />
          <FormInput
            label="Korda uut parooli"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            disabled={busy}
            onChange={(event) => {
              setConfirmPassword(event.target.value)
            }}
          />
          {error && (
            <p role="alert" className="text-bodySm text-danger">
              {error}
            </p>
          )}
          <div className="mt-2xs flex flex-col gap-xs sm:flex-row">
            <Btn variant="outline" type="button" onClick={handleClose} disabled={busy}>
              Katkesta
            </Btn>
            <Btn type="submit" isLoading={busy}>
              Salvesta parool
            </Btn>
          </div>
        </form>
      )}
    </Modal>
  )
}
