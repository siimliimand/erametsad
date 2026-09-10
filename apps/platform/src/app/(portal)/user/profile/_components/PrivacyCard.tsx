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

export function PrivacyCard({ profile, onChanged }: PrivacyCardProps) {
  const [exportNote, setExportNote] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

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
          onClick={() => {
            setExportNote('Eksporditaotlus esitatakse toe kaudu.')
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
