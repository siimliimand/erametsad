'use client'

import { Btn } from '@erametsad/ui'
import { FileDown, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { ConsentsLog } from './ConsentsLog'
import { DeleteAccountModal } from './DeleteAccountModal'
import { ProfileCardShell } from './ProfileCardShell'
import type { ProfileView } from './types'

interface PrivacyCardProps {
  profile: ProfileView | null
  onChanged: (profiles: ProfileView[]) => void
}

const dangerButton =
  'inline-flex h-10 items-center justify-center gap-2 rounded-button border border-danger bg-transparent px-4 font-label text-label font-semibold text-danger transition-colors duration-hover ease-hover hover:bg-dangerLight motion-reduce:transition-none'

const EXPORT_ENDPOINT = '/api/v1/my/export'
const EXPORT_FALLBACK_FILENAME = 'erametsad-andmed.zip'

function downloadBlob(blob: Blob, disposition: string | null): void {
  const match = /filename="?([^";]+)"?/.exec(disposition ?? '')
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = match?.[1] ?? EXPORT_FALLBACK_FILENAME
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function PrivacyCard({ profile, onChanged }: PrivacyCardProps) {
  const [exportNote, setExportNote] = useState<string | null>(null)
  const [exportBusy, setExportBusy] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  async function exportData() {
    setExportBusy(true)
    setExportNote(null)
    try {
      const response = await fetch(EXPORT_ENDPOINT)
      if (!response.ok) {
        throw new Error(String(response.status))
      }
      downloadBlob(await response.blob(), response.headers.get('content-disposition'))
      setExportNote('Teie andmed on allalaaditud ZIP-failina.')
    } catch {
      setExportNote('Andmete eksportimine ebaõnnestus. Proovige uuesti.')
    } finally {
      setExportBusy(false)
    }
  }

  return (
    <ProfileCardShell
      labelledBy="profile-privacy-heading"
      title="Privaatsus ja andmed"
      subtitle="Võta kasutusele oma andmekaitse õigused (GDPR)."
    >
      <div className="flex flex-wrap gap-3">
        <Btn
          variant="outline"
          type="button"
          disabled={exportBusy}
          onClick={() => {
            void exportData()
          }}
        >
          <FileDown size={16} aria-hidden="true" />
          Ekspordi mu andmed (ZIP)
        </Btn>
        <button
          type="button"
          className={dangerButton}
          onClick={() => {
            setDeleteOpen(true)
          }}
        >
          <Trash2 size={16} aria-hidden="true" />
          Kustuta konto
        </button>
      </div>

      {exportNote !== null && (
        <p role="status" className="mt-2 text-bodySm text-inkMuted">
          {exportNote}
        </p>
      )}

      {profile !== null && (
        <ConsentsLog profile={profile} onChanged={onChanged} />
      )}

      <DeleteAccountModal
        isOpen={deleteOpen}
        onClose={() => {
          setDeleteOpen(false)
        }}
      />
    </ProfileCardShell>
  )
}
