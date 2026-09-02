'use client'

import { Btn, FormCheck, FormInput, Steps, type StepItem } from '@erametsad/ui'
import Link from 'next/link'
import { useState } from 'react'

import {
  completeContract,
  downloadContractDocument,
  prepareContract,
  randomControlCode,
  type ContractFlowSnapshot,
  type EidMethod,
} from './contract-api'
import { ContractTimeline } from './contract-timeline'
import { DeadlineChip } from './deadline-chip'
import { EidMethodCards } from '../../login/_components/EidMethodCards'

export interface IdentityPrefill {
  name: string
  codeLabel: 'Isikukood' | 'Registrikood'
  code: string
  address: string
  email: string
  phone: string
}

export interface SigningFlowProps {
  kind: 'framework' | 'auction'
  auctionId: string | null
  auctionTitle: string | null
  templateVersion: string | null
  initial: ContractFlowSnapshot
  identity: IdentityPrefill | null
  nextPath: string | null
  deadlineIso: string | null
}

function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"
      aria-hidden="true"
    />
  )
}

function DocumentViewer({ html, filename }: { html: string; filename: string }) {
  return (
    <div className="flex flex-col gap-sm">
      <iframe
        title="Lepingu eelvaade"
        sandbox=""
        srcDoc={html}
        className="h-[420px] w-full rounded-card border border-border bg-white"
      />
      <div>
        <Btn
          variant="outline"
          size="sm"
          onClick={() => {
            downloadContractDocument(html, filename)
          }}
        >
          Laadi alla
        </Btn>
      </div>
    </div>
  )
}

export function SigningFlow({
  kind,
  auctionId,
  auctionTitle,
  templateVersion,
  initial,
  identity,
  nextPath,
  deadlineIso,
}: SigningFlowProps) {
  const docName = kind === 'framework' ? 'Raamleping' : 'Oksjonileping'
  const filename = `${docName.toLowerCase()}-v${templateVersion ?? '1'}.html`
  const stepCount = kind === 'framework' ? 4 : 3
  const firstStep = kind === 'framework' ? 1 : 2

  const initialStep =
    initial.status === 'signed'
      ? 4
      : initial.status === 'sent'
        ? 3
        : initial.status === 'prepared'
          ? 2
          : firstStep

  const [step, setStep] = useState(initialStep)
  const [status, setStatus] = useState(initial.status)
  const [contractId, setContractId] = useState(initial.contractId)
  const [renderedHtml, setRenderedHtml] = useState(initial.renderedHtml)
  const [signedAt, setSignedAt] = useState(initial.signedAt)
  const signedOnLoad = initial.status === 'signed'

  const [identityName, setIdentityName] = useState(identity?.name ?? '')
  const [identityCode, setIdentityCode] = useState(identity?.code ?? '')
  const [identityAddress, setIdentityAddress] = useState(identity?.address ?? '')
  const [identityEmail, setIdentityEmail] = useState(identity?.email ?? '')
  const [identityPhone, setIdentityPhone] = useState(identity?.phone ?? '')

  const [readCheck, setReadCheck] = useState(false)
  const [method, setMethod] = useState<EidMethod | null>(null)
  const [ceremonyOpen, setCeremonyOpen] = useState(false)
  const [controlCode, setControlCode] = useState(
    initial.status === 'sent' ? randomControlCode() : null,
  )
  const [pin2, setPin2] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePrepare() {
    if (auctionId === null) return
    setBusy(true)
    setError(null)
    const result = await prepareContract(kind, auctionId)
    setBusy(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setContractId(result.contractId)
    setRenderedHtml(result.renderedHtml)
    setStatus('prepared')
    setStep(2)
  }

  function handleOpenForSigning() {
    // The mock ceremony runs entirely client-side over the `prepared`
    // contract: the phase-2 service signs only `prepared` rows and offers no
    // persisted prepared→sent transition.
    setError(null)
    setStatus('sent')
    setStep(3)
  }

  function handleContinueToCeremony() {
    if (method === null) {
      setError('Vali allkirjastamisviis.')
      return
    }
    setError(null)
    setControlCode(randomControlCode())
    setCeremonyOpen(true)
  }

  async function handleSign() {
    if (contractId === null) return
    if (!/^\d{4,8}$/.test(pin2.trim())) {
      setError('Sisesta 4–8-kohaline PIN2 kood.')
      return
    }
    setBusy(true)
    setError(null)
    const result = await completeContract(kind, contractId)
    if (result.ok) {
      setBusy(false)
      setStatus('signed')
      setSignedAt(result.signedAt)
      setStep(4)
      return
    }
    setBusy(false)
    setPin2('')
    if (result.httpStatus === 410) {
      setCeremonyOpen(false)
      setStatus('voided')
      setStep(2)
      setError('Allkirjastamise seanss aegus. Koosta leping uuesti.')
      return
    }
    setError(result.message)
  }

  const steps: StepItem[] =
    kind === 'framework'
      ? [
          { id: 'andmed', label: 'Andmed', status: stepStatus(1, step) },
          { id: 'kontroll', label: 'Kontroll', status: stepStatus(2, step) },
          { id: 'allkiri', label: 'Allkiri', status: stepStatus(3, step) },
          { id: 'valmis', label: 'Valmis', status: stepStatus(4, step) },
        ]
      : [
          { id: 'kontroll', label: 'Kontroll', status: stepStatus(2, step) },
          { id: 'allkiri', label: 'Allkiri', status: stepStatus(3, step) },
          { id: 'valmis', label: 'Valmis', status: stepStatus(4, step) },
        ]

  const signedDate =
    signedAt !== null
      ? new Date(signedAt).toLocaleDateString('et-EE', { dateStyle: 'long' })
      : null

  return (
    <div className="mx-auto flex w-full max-w-container-sm flex-col gap-md">
      <div className="flex flex-col gap-2xs">
        <p className="font-label font-semibold uppercase tracking-wide text-inkMuted">{docName}</p>
        <div className="flex items-center justify-between gap-sm">
          <h1 className="font-heading text-h3 text-ink">Allkirjastamine {step}/{stepCount}</h1>
          {auctionTitle !== null && (
            <span className="truncate font-body text-bodySm text-inkMuted">{auctionTitle}</span>
          )}
        </div>
        <Steps steps={steps} variant="numbered" orientation="horizontal" />
      </div>

      {deadlineIso !== null && status !== 'signed' && <DeadlineChip deadlineIso={deadlineIso} />}

      {error !== null && (
        <p role="alert" aria-live="polite" className="rounded-card border border-danger/30 bg-danger/5 px-md py-sm font-body text-bodySm text-danger">
          {error}
        </p>
      )}

      <div className="rounded-card border border-border bg-white p-md shadow-card md:p-lg">
        {step === 1 && identity !== null && (
          <section aria-label="Samm 1: Andmed" className="flex flex-col gap-md">
            <p className="font-body text-body text-inkMuted">
              Sisesta enda andmed lepingu koostamiseks, tutvu dokumendiga ja allkirjasta see.
            </p>
            <div className="grid gap-sm sm:grid-cols-2">
              <FormInput
                label="Pakkuja nimi"
                name="party-name"
                value={identityName}
                onChange={(event) => { setIdentityName(event.target.value) }}
              />
              <FormInput
                label={identity.codeLabel}
                name="party-code"
                inputMode="numeric"
                value={identityCode}
                onChange={(event) => { setIdentityCode(event.target.value) }}
              />
              <FormInput
                label="Aadress"
                name="party-address"
                value={identityAddress}
                onChange={(event) => { setIdentityAddress(event.target.value) }}
              />
              <FormInput
                label="E-post"
                name="party-email"
                type="email"
                value={identityEmail}
                onChange={(event) => { setIdentityEmail(event.target.value) }}
              />
              <FormInput
                label="Telefon"
                name="party-phone"
                type="tel"
                value={identityPhone}
                onChange={(event) => { setIdentityPhone(event.target.value) }}
              />
            </div>
            <div>
              <Btn
                onClick={() => {
                  if (identityName.trim() === '' || identityCode.trim() === '') {
                    setError('Sisesta nimi ja ' + identity.codeLabel.toLowerCase() + '.')
                    return
                  }
                  setError(null)
                  setStep(2)
                }}
              >
                Jätka
              </Btn>
            </div>
          </section>
        )}

        {step === 2 && (
          <section aria-label="Samm 2: Kontroll" className="flex flex-col gap-md">
            {status === 'voided' && (
              <p className="rounded-card border border-danger/30 bg-danger/5 px-md py-sm font-body text-bodySm text-danger">
                Leping tühistati. Koosta leping uuesti.
              </p>
            )}
            {status === 'none' || status === 'voided' || renderedHtml === null ? (
              <>
                <p className="font-body text-body text-inkMuted">
                  Koostame dokumendi aktiivse malli alusel. Seejärel saad selle läbi lugeda.
                </p>
                {templateVersion !== null && (
                  <p className="font-body text-bodySm text-inkMuted">
                    Malli versioon: {templateVersion}
                  </p>
                )}
                <div>
                  <Btn onClick={() => void handlePrepare()} isLoading={busy} disabled={auctionId === null}>
                    Koosta leping
                  </Btn>
                </div>
                {auctionId === null && (
                  <p className="font-body text-bodySm text-inkMuted">
                    Raamlepingut saab allkirjastada oksjoni juurest: ava oksjon ja proovi pakkumist esitada.
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="font-body text-body text-inkMuted">
                  {docName}
                  {templateVersion !== null ? ` v${templateVersion}` : ''} · tutvu dokumendiga enne allkirjastamist.
                </p>
                <DocumentViewer html={renderedHtml} filename={filename} />
                <FormCheck
                  label="Olen dokumendi läbi lugenud"
                  name="read-check"
                  checked={readCheck}
                  onChange={(event) => { setReadCheck(event.target.checked) }}
                />
                <div>
                  <Btn onClick={handleOpenForSigning} disabled={!readCheck}>
                    Ava allkirjastamiseks
                  </Btn>
                </div>
                <p className="font-body text-bodySm text-inkMuted">
                  Leping tuleb allkirjastada 15 minuti jooksul peale koostamist; aegunud leping koostatakse uuesti.
                </p>
              </>
            )}
          </section>
        )}

        {step === 3 && (
          <section aria-label="Samm 3: Allkiri" className="flex flex-col gap-md">
            {!ceremonyOpen ? (
              <>
                <h2 className="font-heading text-h4 text-ink">Vali allkirjastamisviis</h2>
                <EidMethodCards
                  selected={method}
                  disabled={busy}
                  onSelect={(selected) => {
                    setMethod(selected)
                    setError(null)
                  }}
                />
                <p className="font-body text-bodySm text-inkMuted">
                  Vaheta seadet või kasuta Mobiil-ID-d, kui Smart-ID rakendus ühel ekraanil ei mahu.
                </p>
                <div>
                  <Btn onClick={handleContinueToCeremony}>Jätka</Btn>
                </div>
              </>
            ) : (
              <>
                <h2 className="font-heading text-h4 text-ink">Kontrollkood</h2>
                <p className="font-body text-body text-inkMuted">
                  Kontrolli, et telefonis kuvatakse sama koodi, seejärel sisesta PIN2.
                </p>
                <p
                  className="rounded-card border border-border bg-bgMist px-md py-md text-center font-mono text-h1 font-bold tracking-[0.3em] text-primary"
                  aria-live="polite"
                >
                  {controlCode ?? '····'}
                </p>
                <div className="max-w-56">
                  <FormInput
                    label="PIN2"
                    name="pin2"
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={8}
                    value={pin2}
                    onChange={(event) => { setPin2(event.target.value) }}
                  />
                </div>
                <div className="flex flex-wrap gap-sm">
                  <Btn onClick={() => void handleSign()} isLoading={busy}>
                    Allkirjasta
                  </Btn>
                  <Btn
                    variant="ghost"
                    onClick={() => {
                      setCeremonyOpen(false)
                      setPin2('')
                      setError(null)
                    }}
                  >
                    Tühista
                  </Btn>
                </div>
                {busy && (
                  <p className="flex items-center gap-xs font-body text-bodySm text-inkMuted">
                    <Spinner /> Kinnitame allkirja…
                  </p>
                )}
              </>
            )}
          </section>
        )}

        {step === 4 && (
          <section aria-label="Samm 4: Valmis" className="flex flex-col gap-md">
            {kind === 'framework' ? (
              <h2 className="font-heading text-h3 text-ink">
                {signedOnLoad ? `Sul on raamleping jõus alates ${signedDate ?? 'allkirjastamise kuupäevast'}.` : 'Raamleping on allkirjastatud.'}
              </h2>
            ) : (
              <h2 className="font-heading text-h3 text-ink">
                {signedOnLoad ? 'Leping on allkirjastatud.' : 'Leping on allkirjastatud — laadi fail alla.'}
              </h2>
            )}
            {signedDate !== null && !signedOnLoad && (
              <p className="font-body text-body text-inkMuted">Allkirjastatud {signedDate}.</p>
            )}
            {renderedHtml !== null && (
              <div>
                <Btn
                  variant="outline"
                  onClick={() => {
                    downloadContractDocument(renderedHtml, filename)
                  }}
                >
                  Laadi alla
                </Btn>
              </div>
            )}
            {kind === 'framework' && nextPath !== null && (
              <div>
                <Btn
                  onClick={() => {
                    window.location.assign(nextPath)
                  }}
                >
                  Jätka pakkumisega
                </Btn>
              </div>
            )}
            {kind === 'auction' && auctionId !== null && (
              <Link
                href={`/oksjon/${auctionId}`}
                className="font-label font-semibold text-primary underline-offset-2 hover:underline"
              >
                Vaata oksjonit
              </Link>
            )}
          </section>
        )}
      </div>

      {status !== 'none' && (
        <div className="rounded-card border border-border bg-white p-md shadow-card">
          <ContractTimeline
            status={status === 'prepared' && step >= 3 ? 'sent' : status}
            createdAt={initial.createdAt}
            sentAt={status === 'sent' ? initial.updatedAt : null}
            signedAt={signedAt}
          />
        </div>
      )}
    </div>
  )
}

function stepStatus(index: number, current: number): StepItem['status'] {
  if (index < current) return 'completed'
  if (index === current) return 'current'
  return 'upcoming'
}
