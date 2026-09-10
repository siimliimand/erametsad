'use client'

import { FormCheck } from '@erametsad/ui'
import { useEffect, useState } from 'react'

import {
  ACCEPT_ALL,
  NECESSARY_ONLY,
  saveConsent,
  useConsent,
  type ConsentState,
} from '@/app/(marketing)/_lib/use-consent'

// Portal footer contract (task 1.3): the "Küpsisesätted" button dispatches
// this CustomEvent on document to reopen the banner.
const OPEN_COOKIE_SETTINGS_EVENT = 'erametsad:open-cookie-settings'

// Demo .btn.btn-sm (docs/design/demo/portal): 32px tall, 14px text, radius 10.
const actionButton =
  'inline-flex min-h-8 items-center justify-center whitespace-nowrap rounded-button border border-transparent px-3.5 py-1.5 text-bodySm font-semibold transition-colors duration-hover'

export function CookieBanner() {
  const { consent, ready } = useConsent()
  const [open, setOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [draft, setDraft] = useState<ConsentState>(NECESSARY_ONLY)

  // The consent cookie is client-only: render nothing on the server and
  // open after mount only when no decision exists yet.
  useEffect(() => {
    if (ready && consent === null) setOpen(true)
  }, [ready, consent])

  useEffect(() => {
    const onOpen = () => {
      setSettingsOpen(false)
      setOpen(true)
    }
    document.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, onOpen)
    return () => {
      document.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, onOpen)
    }
  }, [])

  if (!open) return null

  const decide = (next: ConsentState) => {
    saveConsent(next)
    setSettingsOpen(false)
    setOpen(false)
  }

  const openSettings = () => {
    setDraft(consent ?? NECESSARY_ONLY)
    setSettingsOpen(true)
  }

  return (
    <div
      role="region"
      aria-label="Küpsiste teavitus"
      className="fixed inset-x-4 bottom-4 z-[130] mx-auto flex max-w-[880px] flex-col items-stretch gap-5 rounded-card bg-bgPage px-6 py-5 shadow-modal md:flex-row md:items-center"
    >
      {settingsOpen ? (
        <div className="flex flex-col gap-md md:flex-1">
          <p className="m-0 text-bodySm text-inkMuted">
            <b className="font-semibold text-ink">Küpsisesätted.</b> Vali, milliseid küpsiseid sa lubad.
          </p>
          <FormCheck
            name="consent-necessary"
            label="Vajalikud küpsised"
            checked
            readOnly
            disabled
            hint="Alati sisselülitatud — tagavad lehe toimimise."
          />
          <FormCheck
            name="consent-statistics"
            label="Statistika ja analüütika"
            checked={draft.statistics}
            onChange={(event) => {
              const { checked } = event.target
              setDraft((previous) => ({
                ...previous,
                statistics: checked,
              }))
            }}
            hint="Statistilised küpsised aitavad meil aru saada, milline sisu on kasulik."
          />
          <FormCheck
            name="consent-marketing"
            label="Turundus"
            checked={draft.marketing}
            onChange={(event) => {
              const { checked } = event.target
              setDraft((previous) => ({
                ...previous,
                marketing: checked,
              }))
            }}
            hint="Turundusküpsised aitavad meil sisu ja pakkumisi suunata."
          />
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => {
                decide({
                  necessary: true,
                  statistics: draft.statistics,
                  marketing: draft.marketing,
                })
              }}
              className={`${actionButton} flex-1 bg-cta text-ink hover:bg-ctaHover md:flex-none`}
            >
              Salvesta sätted
            </button>
            <button
              type="button"
              onClick={() => {
                setSettingsOpen(false)
              }}
              className={`${actionButton} flex-1 bg-transparent text-inkMuted hover:text-ink md:flex-none`}
            >
              Tagasi
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="m-0 text-bodySm text-inkMuted md:flex-1 md:basis-80">
            <b className="font-semibold text-ink">Kasutame küpsiseid.</b> Vajalikud küpsised tagavad lehe toimimise, analüütika abil mõõdame liiklust. Vali, mida lubad.
          </p>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => {
                decide(ACCEPT_ALL)
              }}
              className={`${actionButton} flex-1 bg-cta text-ink hover:bg-ctaHover md:flex-none`}
            >
              Nõustun kõigiga
            </button>
            <button
              type="button"
              onClick={() => {
                decide(NECESSARY_ONLY)
              }}
              className={`${actionButton} flex-1 border-primary bg-transparent text-primary hover:bg-primaryLight hover:text-primaryHover md:flex-none`}
            >
              Ainult vajalikud
            </button>
            <button
              type="button"
              onClick={openSettings}
              className={`${actionButton} flex-1 bg-transparent text-inkMuted hover:text-ink md:flex-none`}
            >
              Sätete muutmine
            </button>
          </div>
        </>
      )}
    </div>
  )
}
