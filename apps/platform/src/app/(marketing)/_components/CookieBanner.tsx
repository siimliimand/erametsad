'use client'

import { Btn, FormCheck, Modal } from '@eametsad/ui'
import { useEffect, useState } from 'react'

import {
  ACCEPT_ALL,
  NECESSARY_ONLY,
  saveConsent,
  useConsent,
  type ConsentState,
} from '../_lib/use-consent'

export function CookieBanner() {
  const { consent, ready } = useConsent()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [draft, setDraft] = useState<ConsentState>(NECESSARY_ONLY)

  // Footer contract (task 2.3): "Küpsiste sätete muutmine" renders as an
  // inert <button data-cookie-settings>; this document-level listener is
  // its only behaviour and reopens the granular settings modal.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target =
        event.target instanceof Element
          ? event.target.closest('[data-cookie-settings]')
          : null
      if (!target) return
      setDraft(consent ?? NECESSARY_ONLY)
      setSettingsOpen(true)
    }
    document.addEventListener('click', onClick)
    return () => {
      document.removeEventListener('click', onClick)
    }
  }, [consent])

  if (!ready) return null

  const decide = (next: ConsentState) => {
    saveConsent(next)
    setSettingsOpen(false)
  }

  const openSettings = () => {
    setDraft(consent ?? NECESSARY_ONLY)
    setSettingsOpen(true)
  }

  return (
    <>
      {/* Non-modal: fixed to the viewport bottom, never blocks the page. */}
      {consent === null && (
        <div
          role="region"
          aria-label="Küpsiste nõusolek"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bgPage text-primaryDark"
        >
          <div className="mx-auto flex w-full max-w-container-xl flex-col gap-md px-md py-md md:flex-row md:items-center md:justify-between lg:px-lg">
            <p className="max-w-2xl font-body text-bodySm">
              Kasutame küpsiseid lehe toimimiseks. Statistilised küpsised
              aitavad meil aru saada, milline sisu on kasulik.
            </p>
            <div className="flex flex-col gap-sm md:shrink-0 md:flex-row">
              <Btn
                variant="cta"
                onClick={() => {
                  decide(ACCEPT_ALL)
                }}
              >
                Nõustun kõigiga
              </Btn>
              <Btn
                variant="outline"
                onClick={() => {
                  decide(NECESSARY_ONLY)
                }}
              >
                Ainult vajalikud
              </Btn>
              <Btn
                variant="ghost"
                onClick={() => {
                  openSettings()
                }}
              >
                Sätete muutmine
              </Btn>
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={settingsOpen}
        onClose={() => {
          setSettingsOpen(false)
        }}
        title="Küpsiste sätted"
        size="sm"
      >
        <div className="flex flex-col gap-md">
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
          <Btn
            variant="cta"
            onClick={() => {
              decide({
                necessary: true,
                statistics: draft.statistics,
                marketing: draft.marketing,
              })
            }}
          >
            Salvesta sätted
          </Btn>
        </div>
      </Modal>
    </>
  )
}
