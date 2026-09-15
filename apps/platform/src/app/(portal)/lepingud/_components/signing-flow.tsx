'use client'

import { Btn, FormCheck, FormInput } from '@erametsad/ui'
import { ArrowRight, Check, CreditCard, Download, Info, MessageSquare, Smartphone } from 'lucide-react'
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
import { DeadlineBanner } from './deadline-chip'
import { formatEurCents } from './price-summary'
import type { AuctionSigningContext } from './signing-context'
import { SigningSteps } from './signing-steps'

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
  /** Auction context for the Andmed step (winner line, price, terms). */
  context?: AuctionSigningContext | null
}

const EID_METHODS: readonly {
  id: EidMethod
  label: string
  icon: typeof Smartphone
  waitText: string
  showsControlCode: boolean
}[] = [
  {
    id: 'smartid',
    label: 'Smart-ID',
    icon: Smartphone,
    waitText: 'Kontrolli, et telefonis kuvatakse sama koodi, seejärel sisesta PIN2.',
    showsControlCode: true,
  },
  {
    id: 'mobileid',
    label: 'Mobiil-ID',
    icon: MessageSquare,
    waitText: 'Kontrolli, et telefonis kuvatakse sama koodi, seejärel sisesta PIN2.',
    showsControlCode: true,
  },
  {
    id: 'idcard',
    label: 'ID-kaart',
    icon: CreditCard,
    waitText: 'Sisesta ID-kaardi PIN2 kaardilugejaga.',
    showsControlCode: false,
  },
]

function WaitingSpinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-[34px] w-[34px] animate-spin rounded-full border-[3px] border-border border-t-primary"
    />
  )
}

function ContextRow({ term, value, mono }: { term: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 text-bodySm">
      <dt className="text-inkMuted">{term}</dt>
      <dd className={`m-0 text-right font-semibold ${mono === true ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  )
}

interface ContextBlockProps {
  title: string
  children: React.ReactNode
}

function ContextBlock({ title, children }: ContextBlockProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <h3 className="m-0 text-[13px] font-semibold uppercase tracking-[0.04em] text-inkMuted">
        {title}
      </h3>
      <dl className="grid content-start gap-1.5">{children}</dl>
    </div>
  )
}

interface DocumentViewerProps {
  html: string
  filename: string
  versionLabel: string
  agreeChecked: boolean
  onAgreeChange: (checked: boolean) => void
  onOpenForSigning: () => void
}

function DocumentViewer({
  html,
  filename,
  versionLabel,
  agreeChecked,
  onAgreeChange,
  onOpenForSigning,
}: DocumentViewerProps) {
  return (
    <div className="overflow-hidden rounded-card border border-border bg-white shadow-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-bgMist px-5 py-3.5">
        <span className="text-bodySm font-bold text-ink">{versionLabel}</span>
        <span className="font-mono text-[13px] text-inkMuted">PDF eelvaade</span>
        <Btn
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => {
            downloadContractDocument(html, filename)
          }}
        >
          <Download aria-hidden="true" size={14} /> Laadi alla PDF
        </Btn>
      </div>
      <iframe
        title="Lepingu eelvaade"
        sandbox=""
        srcDoc={html}
        className="h-[420px] w-full border-b border-border bg-white"
      />
      <p className="flex items-center gap-2 px-5 pt-2.5 font-body text-[13px] text-inkMuted">
        <Info aria-hidden="true" size={14} className="flex-none text-info" />
        Kerige dokument läbi — leping jääb pärast allkirjastamist sinu profiili.
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 pb-5 pt-3">
        <FormCheck
          label="Olen dokumendi läbi lugenud ja nõustun tingimustega"
          name="read-check"
          checked={agreeChecked}
          onChange={(event) => { onAgreeChange(event.target.checked) }}
          className="min-w-[240px] flex-1"
        />
        <Btn onClick={onOpenForSigning} disabled={!agreeChecked}>
          Ava allkirjastamiseks
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
  context = null,
}: SigningFlowProps) {
  const docName = kind === 'framework' ? 'Raamleping' : 'Oksjonileping'
  const filename = `${docName.toLowerCase()}-v${templateVersion ?? '1'}.html`
  const versionLabel = `${docName}${templateVersion !== null ? ` v${templateVersion}` : ''}`

  const initialStep =
    initial.status === 'signed'
      ? 4
      : initial.status === 'sent'
        ? 3
        : initial.status === 'prepared'
          ? 2
          : 1

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
    if (kind === 'auction' && auctionId === null) return
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

  function handleMethodSelect(selected: EidMethod) {
    setError(null)
    setMethod(selected)
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

  const selectedMethod = EID_METHODS.find((entry) => entry.id === method) ?? null

  const signedDate =
    signedAt !== null
      ? new Date(signedAt).toLocaleDateString('et-EE', { dateStyle: 'long' })
      : null
  const signedTime =
    signedAt !== null
      ? new Date(signedAt).toLocaleTimeString('et-EE', { hour: '2-digit', minute: '2-digit' })
      : null

  const winnerParts =
    context !== null
      ? [
          context.countyName,
          context.areaHa !== null
            ? `${context.areaHa.toLocaleString('et-EE', { maximumFractionDigits: 1 })} ha`
            : null,
          context.objectTypeLabel,
          context.wonText,
        ].filter((part): part is string => part !== null)
      : []

  const price = context?.price ?? null
  const loggingDeadline = context?.loggingDeadline ?? null
  const removalDeadline = context?.removalDeadline ?? null

  return (
    <div className="flex flex-col gap-5">
      {deadlineIso !== null && status !== 'signed' && <DeadlineBanner deadlineIso={deadlineIso} />}

      <SigningSteps typeLabel={docName} current={step} />

      {error !== null && (
        <p role="alert" aria-live="polite" className="rounded-card border border-danger/30 bg-danger/5 px-md py-sm font-body text-bodySm text-danger">
          {error}
        </p>
      )}

      {step === 1 && (
        <section aria-label="Samm 1: Andmed" className="flex flex-col gap-5">
          {kind === 'auction' && context !== null ? (
            <>
              <div className="rounded-card border border-border bg-white p-6 shadow-card">
                <h2 className="mb-1 font-heading text-[22px] font-bold text-ink">
                  {auctionTitle !== null ? `${docName} — ${auctionTitle}` : docName}
                </h2>
                {winnerParts.length > 0 && (
                  <p className="font-body text-bodySm text-inkMuted">
                    {winnerParts.join(' · ')}
                    {auctionId !== null && (
                      <>
                        {' '}
                        <Link
                          href={`/oksjon/${auctionId}`}
                          className="font-semibold text-primary underline-offset-2 hover:underline"
                        >
                          Vaata oksjonit
                        </Link>
                      </>
                    )}
                  </p>
                )}
                <div className="mt-[18px] grid gap-5 border-t border-border pt-[18px] md:grid-cols-2 xl:grid-cols-3">
                  {identity !== null && (
                    <ContextBlock title="Ostja (andmed profiilist)">
                      {identityName !== '' && <ContextRow term="Nimi" value={identityName} />}
                      {identityCode !== '' && (
                        <ContextRow term={identity.codeLabel} value={identityCode} mono />
                      )}
                      {identityEmail !== '' && <ContextRow term="E-post" value={identityEmail} />}
                      {identityPhone !== '' && (
                        <ContextRow term="Telefon" value={identityPhone} mono />
                      )}
                      <p className="m-0 mt-1 font-body text-[13px] text-inkMuted">
                        Andmed on muudetavad{' '}
                        <Link
                          href="/user/profile"
                          className="font-semibold text-primary underline-offset-2 hover:underline"
                        >
                          profiilis
                        </Link>{' '}
                        enne allkirjastamist.
                      </p>
                    </ContextBlock>
                  )}
                  {context.price !== null && (
                    <ContextBlock title="Hinna kokkuvõte">
                      <ContextRow
                        term="Sinu lõpphind"
                        value={formatEurCents(context.price.finalPriceCents)}
                        mono
                      />
                      <ContextRow
                        term={`Teenustasu ${String(context.price.feePercent)}%`}
                        value={formatEurCents(context.price.feeCents)}
                        mono
                      />
                      <ContextRow
                        term={`Käibemaks ${String(context.price.vatPercent)}% (teenustasule)`}
                        value={formatEurCents(context.price.vatCents)}
                        mono
                      />
                      <div className="mt-1 flex justify-between gap-4 border-t border-border pt-2 text-bodySm">
                        <dt className="text-inkMuted">Kokku laekumisel</dt>
                        <dd className="m-0 text-right font-mono text-[17px] font-semibold text-ctaHover">
                          {formatEurCents(context.price.totalCents)}
                        </dd>
                      </div>
                    </ContextBlock>
                  )}
                  <ContextBlock title="Makse- ja raietingimused">
                    <ContextRow term="Makse tähtaeg" value="10 päeva arve saamisest" />
                    {context.loggingDeadline !== null && (
                      <ContextRow term="Raietähtaeg" value={context.loggingDeadline} mono />
                    )}
                    {context.removalDeadline !== null && (
                      <ContextRow term="Väljaveo tähtaeg" value={context.removalDeadline} mono />
                    )}
                  </ContextBlock>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
                <Btn
                  onClick={() => {
                    setError(null)
                    setStep(2)
                  }}
                >
                  Jätka kontrolli <ArrowRight aria-hidden="true" size={16} />
                </Btn>
                <p className="m-0 font-body text-bodySm text-inkMuted">
                  Andmed tulevad sinu profiilist ja võidetud pakkumisest — sisestada ei ole vaja
                  midagi.
                </p>
              </div>
            </>
          ) : (
            <div className="rounded-card border border-border bg-white p-6 shadow-card md:p-lg">
              <h2 className="mb-1 font-heading text-[22px] font-bold text-ink">
                Ostja (andmed profiilist)
              </h2>
              <p className="mb-4 font-body text-bodySm text-inkMuted">
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
                  label={identity?.codeLabel ?? 'Isikukood'}
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
              <div className="mt-md">
                <Btn
                  onClick={() => {
                    const codeLabel = (identity?.codeLabel ?? 'Isikukood').toLowerCase()
                    if (identityName.trim() === '' || identityCode.trim() === '') {
                      setError('Sisesta nimi ja ' + codeLabel + '.')
                      return
                    }
                    setError(null)
                    setStep(2)
                  }}
                >
                  Jätka kontrolli <ArrowRight aria-hidden="true" size={16} />
                </Btn>
              </div>
            </div>
          )}
        </section>
      )}

      {step === 2 && (
        <section aria-label="Samm 2: Kontroll" className="flex flex-col gap-5">
          {status === 'voided' && (
            <p className="rounded-card border border-danger/30 bg-danger/5 px-md py-sm font-body text-bodySm text-danger">
              Leping tühistati. Koosta leping uuesti.
            </p>
          )}
          {status === 'none' || status === 'voided' || renderedHtml === null ? (
            <div className="rounded-card border border-border bg-white p-6 shadow-card md:p-lg">
              <p className="font-body text-body text-inkMuted">
                Koostame dokumendi aktiivse malli alusel. Seejärel saad selle läbi lugeda.
              </p>
              {templateVersion !== null && (
                <p className="font-body text-bodySm text-inkMuted">
                  Malli versioon: {templateVersion}
                </p>
              )}
              <div className="mt-sm">
                <Btn
                  onClick={() => void handlePrepare()}
                  isLoading={busy}
                  disabled={kind === 'auction' && auctionId === null}
                >
                  Koosta leping
                </Btn>
              </div>
              {kind === 'auction' && auctionId === null && (
                <p className="mt-sm font-body text-bodySm text-inkMuted">
                  Raamlepingut saab allkirjastada oksjoni juurest: ava oksjon ja proovi pakkumist
                  esitada.
                </p>
              )}
            </div>
          ) : (
            <>
              <DocumentViewer
                html={renderedHtml}
                filename={filename}
                versionLabel={versionLabel}
                agreeChecked={readCheck}
                onAgreeChange={setReadCheck}
                onOpenForSigning={handleOpenForSigning}
              />
              <p className="font-body text-bodySm text-inkMuted">
                Leping tuleb allkirjastada 15 minuti jooksul peale koostamist; aegunud leping
                koostatakse uuesti.
              </p>
            </>
          )}
        </section>
      )}

      {step === 3 && (
        <section aria-label="Samm 3: Allkiri" className="flex flex-col gap-5">
          <div className="rounded-card border border-border bg-white p-6 shadow-card">
            <h2 className="mb-1 font-heading text-[22px] font-bold text-ink">Allkirjasta leping</h2>
            <p className="mb-[18px] font-body text-bodySm text-inkMuted">
              Leping saadetakse allkirjastamise teenusesse. Kontrollkood kehtib 15 minutit, seejärel
              tuleb andmed uuesti ette valmistada.
            </p>
            {selectedMethod === null || !ceremonyOpen ? (
              <>
                <div
                  role="group"
                  aria-label="Allkirjastamisviisid"
                  className="grid gap-3.5 sm:grid-cols-3"
                >
                  {EID_METHODS.map((entry) => {
                    const Icon = entry.icon
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        disabled={busy}
                        onClick={() => { handleMethodSelect(entry.id) }}
                        className="flex min-h-[104px] flex-col items-center justify-center gap-2 rounded-button border border-border bg-white px-4 font-semibold text-ink transition-colors duration-hover ease-hover motion-reduce:transition-none hover:border-primary hover:bg-primaryLight disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Icon aria-hidden="true" size={26} className="text-primary" />
                        {entry.label}
                      </button>
                    )
                  })}
                </div>
                <p className="mb-0 mt-[18px] flex items-start gap-2 rounded-button bg-infoLight px-4 py-3 font-body text-bodySm text-ink">
                  <Info aria-hidden="true" size={15} className="mt-[3px] flex-none text-info" />
                  Vaheta seadet või kasuta Mobiil-ID-d, kui Smart-ID rakendus ühel ekraanil ei mahu.
                </p>
                <p className="mb-0 mt-3 font-body text-[13px] text-inkMuted">
                  Allkirjastamine ei õnnestu? Võta ühendust info@erametsad.ee.
                </p>
              </>
            ) : (
              <div className="flex flex-col items-center gap-4 px-4 pb-2 pt-6 text-center">
                <WaitingSpinner />
                <p className="m-0 max-w-[34em] font-semibold text-ink">{selectedMethod.waitText}</p>
                {selectedMethod.showsControlCode && controlCode !== null && (
                  <p
                    aria-live="polite"
                    aria-label="Kontrollkood"
                    className="m-0 rounded-button bg-bgMist px-7 py-2.5 font-mono text-[3rem] font-medium leading-none tracking-[0.14em] text-ink"
                  >
                    {controlCode}
                  </p>
                )}
                <div className="w-full max-w-56">
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
                <div className="flex flex-wrap justify-center gap-sm">
                  <Btn onClick={() => void handleSign()} isLoading={busy}>
                    Allkirjasta
                  </Btn>
                  <Btn
                    variant="ghost"
                    onClick={() => {
                      setCeremonyOpen(false)
                      setMethod(null)
                      setPin2('')
                      setError(null)
                    }}
                  >
                    Katkesta allkirjastamine
                  </Btn>
                </div>
                {busy && (
                  <p className="flex items-center gap-xs font-body text-bodySm text-inkMuted">
                    Kinnitame allkirja…
                  </p>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {step === 4 && (
        <section aria-label="Samm 4: Valmis" className="flex flex-col gap-5">
          <div className="flex flex-col items-center gap-3 rounded-card bg-primaryLight px-7 py-12 text-center">
            <Check aria-hidden="true" size={44} strokeWidth={2.5} className="text-primary" />
            <h2 className="m-0 font-heading text-[26px] font-bold text-ink">
              Leping allkirjastatud!
            </h2>
            <p className="m-0 max-w-[44em] font-body text-bodySm text-inkMuted">
              {signedOnLoad ? (
                kind === 'framework' ? (
                  <>Sul on raamleping jõus alates {signedDate ?? 'allkirjastamise kuupäevast'}.</>
                ) : (
                  <>Leping on allkirjastatud.</>
                )
              ) : (
                <>
                  {docName} allkirjastatud {signedDate}
                  {signedTime !== null ? ` kell ${signedTime}` : ''}
                  {identityName.trim() !== '' ? ` · Allkirjastaja ${identityName.trim()}` : ''}.
                  Erametsad lisab vastuallkirja 1 tööpäeva jooksul.
                </>
              )}
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
              {renderedHtml !== null && (
                <Btn
                  onClick={() => {
                    downloadContractDocument(renderedHtml, filename)
                  }}
                >
                  <Download aria-hidden="true" size={16} /> Laadi allkirjastatud fail (.bdoc)
                </Btn>
              )}
              {kind === 'framework' && nextPath !== null && (
                <Btn
                  onClick={() => {
                    window.location.assign(nextPath)
                  }}
                >
                  Jätka pakkumisega
                </Btn>
              )}
              {kind === 'auction' && auctionId !== null && (
                <Link
                  href={`/oksjon/${auctionId}`}
                  className="inline-flex h-12 items-center justify-center rounded-button border border-primary px-6 font-semibold text-primary transition-colors duration-hover hover:bg-primaryLight motion-reduce:transition-none"
                >
                  Vaata oksjonit
                </Link>
              )}
              <Link
                href="/user/bids"
                className="inline-flex h-12 items-center justify-center rounded-button border border-primary px-6 font-semibold text-primary transition-colors duration-hover hover:bg-primaryLight motion-reduce:transition-none"
              >
                Minu pakkumised
              </Link>
              <Link
                href="/"
                className="inline-flex h-12 items-center justify-center rounded-button px-6 font-semibold text-inkMuted transition-colors duration-hover hover:text-ink motion-reduce:transition-none"
              >
                Tagasi oksjonitele
              </Link>
            </div>
          </div>

          <div className="rounded-card border border-border bg-white p-6 shadow-card">
            <h2 className="mb-3.5 font-heading text-[22px] font-bold text-ink">Mis edasi?</h2>
            <ul className="m-0 grid list-none gap-3.5 p-0">
              {price !== null && (
                <li className="flex gap-3 font-body text-bodySm">
                  <Download aria-hidden="true" size={18} className="mt-[3px] flex-none text-primary" />
                  <span>
                    <b>Arve saadetakse.</b> Saadame arve ({formatEurCents(price.totalCents)})
                    sinu e-postile 1 päeva jooksul pärast vastuallkirja. Makse tähtaeg 10 päeva arve
                    saamisest.
                  </span>
                </li>
              )}
              {kind === 'auction' && (
                <li className="flex gap-3 font-body text-bodySm">
                  <Info aria-hidden="true" size={18} className="mt-[3px] flex-none text-primary" />
                  <span>
                    <b>Raieteavitus.</b> Teatame, kui metsateatis on valmis ja raiet saab planeerima
                    hakata.
                    {loggingDeadline !== null && <> Raietähtaeg {loggingDeadline}.</>}
                    {removalDeadline !== null && <> Väljaveo tähtaeg {removalDeadline}.</>}
                  </span>
                </li>
              )}
              <li className="flex gap-3 font-body text-bodySm">
                <Info aria-hidden="true" size={18} className="mt-[3px] flex-none text-primary" />
                <span>
                  <b>Järgmised oksjonid.</b> Vaata aktiivseid oksjoneid ja anna uus pakkumine.
                </span>
              </li>
            </ul>
          </div>
        </section>
      )}

      {status !== 'none' && (
        <ContractTimeline
          status={status === 'prepared' && step >= 3 ? 'sent' : status}
          createdAt={initial.createdAt}
          sentAt={status === 'sent' ? initial.updatedAt : null}
          signedAt={signedAt}
        />
      )}
    </div>
  )
}
