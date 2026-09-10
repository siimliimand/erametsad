'use client'

import { Btn } from '@erametsad/ui'
import { ShieldCheck } from 'lucide-react'
import { useState } from 'react'

import { PasswordModal } from './PasswordModal'
import { ProfileCardShell } from './ProfileCardShell'
import { SessionsList } from './SessionsList'
import type { UserAccount } from './types'

interface SecurityCardProps {
  account: UserAccount
}

export function SecurityCard({ account }: SecurityCardProps) {
  const [passwordOpen, setPasswordOpen] = useState(false)

  return (
    <ProfileCardShell
      labelledBy="profile-security-heading"
      title="Turve"
      subtitle="Sisselogimine, parool ja aktiivsed seanssid."
    >
      <div className="flex flex-wrap items-center gap-sm border-b border-border py-3.5">
        <div className="min-w-0 flex-1 basis-[240px]">
          <p className="m-0 text-bodySm font-semibold text-ink">Parool</p>
          <p className="m-0 mt-0.5 text-bodySm text-inkMuted">
            Pärast parooli vahetamist logitakse kõik seadmed välja.
          </p>
        </div>
        <Btn
          variant="outline"
          size="sm"
          type="button"
          onClick={() => {
            setPasswordOpen(true)
          }}
        >
          Muuda parooli
        </Btn>
      </div>

      {account.eidVerified && (
        <div className="flex flex-wrap items-center gap-sm border-b border-border py-3.5">
          <div className="min-w-0 flex-1 basis-[240px]">
            <p className="flex items-center gap-1.5 text-bodySm font-semibold text-ink">
              <ShieldCheck size={14} aria-hidden="true" />
              eID
            </p>
            <p className="m-0 mt-0.5 text-bodySm text-inkMuted">
              Isikukood kinnitatud
            </p>
          </div>
        </div>
      )}

      <h3 className="mb-1 mt-4 border-t border-border pt-4 font-heading text-[17px] font-bold text-ink">
        Aktiivsed sessioonid
      </h3>
      <SessionsList />

      <PasswordModal
        isOpen={passwordOpen}
        onClose={() => {
          setPasswordOpen(false)
        }}
      />
    </ProfileCardShell>
  )
}
