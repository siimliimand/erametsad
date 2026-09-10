'use client'

import { Btn } from '@erametsad/ui'
import { CircleAlert, CircleCheck } from 'lucide-react'

import { METHOD_LABELS } from './EidMethodCards'
import type { EidMethod } from './eid-client'

// Per-method waiting copy from demo 05-login.html.
const STEP_TITLES: Record<EidMethod, string> = {
  smartid: 'Kontrolli telefoni või arvutit',
  mobileid: 'Kontrolli oma telefoni',
  idcard: 'Kontrolli oma arvutit',
}

const STEP_HINTS: Record<EidMethod, string> = {
  smartid: 'Kontrolli, et telefonis kuvatakse sama numbrit, seejärel sisesta PIN1.',
  mobileid: 'Kinnituskood saadeti SMS-iga. Sisesta telefonis Mobiil-ID PIN1.',
  idcard: 'Sisesta hüpikaknasse ID-kaardi PIN1 ja kinnita sisselogimine.',
}

interface ControlCodeScreenProps {
  method: EidMethod
  controlCode: string | null
  state: 'pending' | 'success' | 'failed'
  onCancel: () => void
  onRestart: () => void
}

function SpinnerRing() {
  return (
    <span
      className="inline-block h-[54px] w-[54px] animate-spin rounded-full border-[3px] border-primaryLight border-t-primary motion-reduce:animate-none motion-reduce:border-t-primaryLight"
      aria-hidden="true"
    />
  )
}

export function ControlCodeScreen({
  method,
  controlCode,
  state,
  onCancel,
  onRestart,
}: ControlCodeScreenProps) {
  if (state === 'success') {
    return (
      <section
        aria-label={`${METHOD_LABELS[method]} autentimine`}
        className="flex flex-col items-center gap-1.5 text-center"
      >
        <CircleCheck className="h-11 w-11 text-accent" aria-hidden="true" />
        <h2 className="font-heading text-h3 text-ink">Sisselogimine õnnestus</h2>
        <p className="font-body text-bodySm text-inkMuted">Suuname sind edasi…</p>
      </section>
    )
  }

  if (state === 'failed') {
    return (
      <section
        aria-label={`${METHOD_LABELS[method]} autentimine`}
        className="flex flex-col items-center gap-1.5 text-center"
      >
        <CircleAlert className="h-11 w-11 text-danger" aria-hidden="true" />
        <h2 className="font-heading text-h3 text-ink">Autentimine ei õnnestunud</h2>
        <p className="font-body text-bodySm text-inkMuted">
          Autentimine katkestati, aegus või lükati tagasi. Saad katse uuesti alustada.
        </p>
        <div className="mt-xs [&_button]:w-full">
          <Btn onClick={onRestart}>Proovi uuesti</Btn>
          <Btn variant="ghost" onClick={onCancel} className="mt-xs">
            Tühista
          </Btn>
        </div>
      </section>
    )
  }

  return (
    <section
      aria-label={`${METHOD_LABELS[method]} autentimine`}
      className="flex flex-col items-center gap-1.5 text-center"
    >
      <SpinnerRing />
      <h2 className="font-heading text-h3 text-ink">{STEP_TITLES[method]}</h2>
      <p className="font-body text-bodySm text-inkMuted">{STEP_HINTS[method]}</p>

      {controlCode ? (
        <div className="mt-sm w-full">
          <p className="font-body text-bodySm font-semibold text-ink">Kontrollkood</p>
          <p
            className="mt-1 rounded-button bg-bgMist px-2 py-2 font-mono text-[2rem] font-semibold leading-[1.2] tracking-[0.3em] text-primaryDark"
            aria-live="polite"
          >
            {controlCode}
          </p>
        </div>
      ) : (
        <p className="mt-sm w-full rounded-button bg-bgMist px-md py-md font-body text-bodySm text-inkMuted">
          Kontrollkoodi ei kuvatud. Jätka autentimist oma seadmes.
        </p>
      )}

      <p className="mt-sm flex items-center gap-xs font-body text-bodySm text-inkMuted">
        <span
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent motion-reduce:animate-none motion-reduce:border-t-primary"
          aria-hidden="true"
        />
        Ootame sinu kinnitust…
      </p>

      <div className="mt-sm [&_button]:w-full">
        <Btn variant="ghost" onClick={onCancel}>
          Tühista
        </Btn>
      </div>
    </section>
  )
}
