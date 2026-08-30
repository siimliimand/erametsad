'use client'

import { Btn } from '@eametsad/ui'

interface ControlCodeScreenProps {
  methodLabel: string
  controlCode: string | null
  state: 'pending' | 'failed'
  onCancel: () => void
  onRestart: () => void
}

function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"
      aria-hidden="true"
    />
  )
}

export function ControlCodeScreen({
  methodLabel,
  controlCode,
  state,
  onCancel,
  onRestart,
}: ControlCodeScreenProps) {
  if (state === 'failed') {
    return (
      <section aria-label={`${methodLabel} autentimine`} className="flex flex-col gap-md">
        <div className="flex flex-col gap-2xs">
          <h2 className="font-heading text-h3 text-ink">Autentimine ei õnnestunud</h2>
          <p className="font-body text-body text-inkMuted">
            Autentimine katkestati, aegus või lükati tagasi. Saad katse uuesti alustada.
          </p>
        </div>
        <div className="flex flex-wrap gap-sm">
          <Btn onClick={onRestart}>Proovi uuesti</Btn>
          <Btn variant="ghost" onClick={onCancel}>
            Tagasi meetodite juurde
          </Btn>
        </div>
      </section>
    )
  }

  return (
    <section aria-label={`${methodLabel} autentimine`} className="flex flex-col gap-md">
      <div className="flex flex-col gap-2xs">
        <h2 className="font-heading text-h3 text-ink">Kontrollkood</h2>
        <p className="font-body text-body text-inkMuted">
          Kontrolli, et {methodLabel} kuvatav kood ühtib allpool nähtavaga, ja kinnita
          autentimine oma seadmes.
        </p>
      </div>

      {controlCode ? (
        <p
          className="rounded-card border border-border bg-bgMist px-md py-md text-center font-mono text-h1 font-bold tracking-[0.3em] text-primary"
          aria-live="polite"
        >
          {controlCode}
        </p>
      ) : (
        <p className="rounded-card border border-border bg-bgMist px-md py-md text-center font-body text-body text-inkMuted">
          Kontrollkoodi ei kuvatud. Jätka autentimist oma seadmes.
        </p>
      )}

      <p className="flex items-center gap-xs font-body text-bodySm text-inkMuted">
        <Spinner />
        Ootame sinu kinnitust…
      </p>

      <Btn variant="outline" onClick={onCancel}>
        Tühista
      </Btn>
    </section>
  )
}
