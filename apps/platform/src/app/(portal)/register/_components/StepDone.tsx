'use client'

import { Btn } from '@eametsad/ui'
import Link from 'next/link'

interface StepDoneProps {
  target: string
  displayName: string
  profileType: 'private' | 'company'
  approvalStatus: string
}

export function StepDone({ target, displayName, profileType, approvalStatus }: StepDoneProps) {
  const companyPending = profileType === 'company' && approvalStatus !== 'approved'

  return (
    <section aria-label="Konto on loodud" className="mt-md flex flex-col gap-md">
      <div className="flex flex-col gap-2xs">
        <h2 className="font-heading text-h3 text-ink">Konto on loodud</h2>
        <p className="font-body text-body text-inkMuted">
          {companyPending
            ? `Tere, ${displayName}! Ettevõtte profiil ootab administraatori kinnitust. Saadame teavituse, kui profiil on heaks kiidetud.`
            : `Tere, ${displayName}! Saad kohe oksjonitel osaleda.`}
        </p>
      </div>

      <p className="font-body text-bodySm text-inkMuted">
        Konto on avatud ajutise parooliga. Määra endale püsiv parool{' '}
        <Link
          href="/update-password"
          className="font-semibold text-primary underline-offset-2 hover:underline"
        >
          parooli määramise lehel
        </Link>
        .
      </p>

      <Btn onClick={() => { window.location.assign(target); }}>Jätka</Btn>
    </section>
  )
}
