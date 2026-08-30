'use client'

import { SpecialistCard } from '@eametsad/ui'
import { useState } from 'react'

interface SellerContactProps {
  specialist: {
    name: string
    phone: string | null
    email: string | null
  } | null
  aliasEmail: string | null
}

export function SellerContact({ specialist, aliasEmail }: SellerContactProps) {
  const [copied, setCopied] = useState(false)

  if (!specialist && !aliasEmail) return null

  function copyAlias() {
    if (!aliasEmail) return
    navigator.clipboard
      .writeText(aliasEmail)
      .then(() => {
        setCopied(true)
        window.setTimeout(() => {
          setCopied(false)
        }, 2000)
      })
      .catch(() => {
        setCopied(false)
      })
  }

  return (
    <div className="flex flex-col gap-sm rounded-card border border-border bg-bgPage p-md shadow-card">
      <h2 className="font-heading text-h4 text-ink">Müüja kontakt</h2>
      {specialist && (
        <SpecialistCard
          name={specialist.name}
          role="Metsaspetsialist"
          {...(specialist.phone !== null ? { phone: specialist.phone } : {})}
          {...(specialist.email !== null ? { email: specialist.email } : {})}
          mini
        />
      )}
      {aliasEmail && (
        <div className="flex flex-col gap-2xs">
          <span className="text-label text-inkMuted">Küsimused oksjoni kohta</span>
          <div className="flex items-center gap-xs">
            <a
              href={`mailto:${aliasEmail}`}
              className="min-w-0 truncate text-bodySm text-primary hover:text-primaryHover"
            >
              {aliasEmail}
            </a>
            <button
              type="button"
              onClick={copyAlias}
              className="shrink-0 rounded-button border border-border px-xs py-2xs text-label font-semibold text-ink transition-colors duration-hover hover:border-primary hover:text-primary"
            >
              {copied ? 'Kopeeritud' : 'Kopeeri'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
