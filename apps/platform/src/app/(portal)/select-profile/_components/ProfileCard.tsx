'use client'

import { Btn } from '@erametsad/ui'
import { ArrowRight, Building2, Check, Info, Plus, User, X } from 'lucide-react'
import Link from 'next/link'
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

import { apiFetch } from '@/lib/api/client'
import type { AuctionObjectType } from '@/lib/data/schema'

const OBJECT_TYPE_LABELS: Record<AuctionObjectType, string> = {
  raieoigus: 'Raieõigus',
  kinnistu: 'Kinnistu',
  kiire: 'Kiire oksjon',
  pakett: 'Pakett',
}

const OBJECT_TYPES = Object.keys(OBJECT_TYPE_LABELS) as AuctionObjectType[]

export interface ProfileOption {
  id: string
  type: 'private' | 'company'
  name: string
  regCode: string | null
  /** Demo .profile-sub line, composed server-side from profile data. */
  sub: string | null
  active: boolean
  /** Company profile still awaiting approval; renders the dashed card. */
  pending: boolean
  disabled: boolean
  note: string | null
}

interface ProfileCardProps {
  option: ProfileOption
  grantedTypes: AuctionObjectType[]
  checked: boolean
  /** Roving tabindex of the radio group: exactly one card owns 0. */
  tabIndex: -1 | 0
  onChange: () => void
  registerRef: (element: HTMLButtonElement | null) => void
}

// Demo .pill: dot + label. AKTIIVNE reuses the shared status-active token;
// Ülevaatamisel is the muted variant.
function StatusPill({ tone, label }: { tone: 'active' | 'muted'; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill px-3 py-[3px] text-[13px] font-semibold leading-[1.4] ${
        tone === 'active'
          ? 'bg-statusActive/10 text-statusActive'
          : 'bg-inkMuted/10 text-inkMuted'
      }`}
    >
      <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full bg-current" />
      {label}
    </span>
  )
}

// Demo .profile-points: one Lucide Check/X per granted right, all object
// types listed so a missing right reads as unchecked instead of absent.
function RightsList({ grantedTypes }: { grantedTypes: AuctionObjectType[] }): ReactNode {
  return (
    <span className="mt-0.5 flex flex-col gap-1">
      {OBJECT_TYPES.map((objectType) => {
        const granted = grantedTypes.includes(objectType)
        const Icon = granted ? Check : X
        return (
          <span key={objectType} className="flex items-center gap-2 text-[15px]">
            <Icon
              size={13}
              aria-hidden="true"
              className={granted ? 'flex-none text-accent' : 'flex-none text-inkMuted'}
            />
            <span className={granted ? 'text-ink' : 'text-inkMuted'}>
              {OBJECT_TYPE_LABELS[objectType]}
            </span>
          </span>
        )
      })}
    </span>
  )
}

function CardInner({
  option,
  checked,
  grantedTypes,
}: {
  option: ProfileOption
  checked: boolean
  grantedTypes: AuctionObjectType[]
}) {
  const TypeIcon = option.type === 'company' ? Building2 : User
  return (
    <>
      <span
        aria-hidden="true"
        className={`relative mt-[3px] h-5 w-5 flex-none rounded-full border-2 bg-white transition-colors duration-hover ease-hover motion-reduce:transition-none ${
          checked ? 'border-primary' : 'border-border'
        }`}
      >
        <span
          className={`absolute inset-[3px] rounded-full bg-primary transition-opacity duration-hover ease-hover motion-reduce:transition-none ${
            checked ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </span>
      <span
        className={`flex h-12 w-12 flex-none items-center justify-center rounded-button transition-colors duration-hover ease-hover motion-reduce:transition-none ${
          checked ? 'bg-white text-primary' : 'bg-bgMist text-primary'
        }`}
      >
        <TypeIcon size={22} aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-col gap-1.5">
        <span className="flex flex-wrap items-center gap-2.5">
          <span className="font-heading text-[18px] font-bold leading-tight text-ink">
            {option.name}
          </span>
          <span
            className={`rounded-pill px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.02em] text-inkMuted transition-colors duration-hover ease-hover motion-reduce:transition-none ${
              checked ? 'bg-white' : 'bg-bgMist'
            }`}
          >
            {option.type === 'company' ? 'Ettevõte' : 'Eraisik'}
          </span>
          {option.active && <StatusPill tone="active" label="AKTIIVNE" />}
          {option.pending && <StatusPill tone="muted" label="Ülevaatamisel" />}
        </span>
        {option.sub !== null && (
          <span className="text-[15px] text-inkMuted">{option.sub}</span>
        )}
        <RightsList grantedTypes={grantedTypes} />
        {option.note !== null && (
          <span className="text-[15px] text-inkMuted">{option.note}</span>
        )}
      </span>
    </>
  )
}

function ProfileCard({
  option,
  grantedTypes,
  checked,
  tabIndex,
  onChange,
  registerRef,
}: ProfileCardProps) {
  if (option.disabled) {
    // Demo .profile-card-pending: dashed, dimmed, outside the radio group.
    return (
      <div
        aria-disabled="true"
        className="flex w-full cursor-not-allowed items-start gap-4 rounded-card border-2 border-dashed border-border bg-bgMist p-5 opacity-65 shadow-none"
      >
        <CardInner option={option} checked={false} grantedTypes={grantedTypes} />
      </div>
    )
  }
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      tabIndex={tabIndex}
      ref={registerRef}
      onClick={onChange}
      data-profile-id={option.id}
      className={`flex w-full cursor-pointer items-start gap-4 rounded-card border-2 p-5 text-left shadow-card transition-colors duration-hover ease-hover motion-reduce:transition-none ${
        checked
          ? 'border-primary bg-primaryLight shadow-card-hover max-md:border-l-[6px]'
          : 'border-border bg-white hover:border-primary'
      }`}
    >
      <CardInner option={option} checked={checked} grantedTypes={grantedTypes} />
    </button>
  )
}

interface ProfileSelectorProps {
  options: ProfileOption[]
  activeProfileId: string | null
  grantedTypes: AuctionObjectType[]
  next: string | null
}

export function ProfileSelector({
  options,
  activeProfileId,
  grantedTypes,
  next,
}: ProfileSelectorProps) {
  const initialSelected =
    options.find((option) => option.id === activeProfileId && !option.disabled)?.id ??
    options.find((option) => !option.disabled)?.id ??
    null
  const [selectedId, setSelectedId] = useState<string | null>(initialSelected)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectable = options.filter((option) => !option.disabled)
  const tabStopId = selectedId ?? selectable[0]?.id ?? null
  const selected = options.find((option) => option.id === selectedId) ?? null
  const radioRefs = useRef(new Map<string, HTMLButtonElement>())

  const target = next ?? '/'
  const registerHref = next ? `/register?next=${encodeURIComponent(next)}` : '/register'

  function registerRef(id: string) {
    return (element: HTMLButtonElement | null) => {
      if (element !== null) {
        radioRefs.current.set(id, element)
      } else {
        radioRefs.current.delete(id)
      }
    }
  }

  // Demo radio-group keyboard model: arrows move the selection (wrapping,
  // skipping the dashed pending card), Enter/Space confirm through the
  // button's native click.
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (busy || selectable.length === 0) return
    const forward = event.key === 'ArrowDown' || event.key === 'ArrowRight'
    const backward = event.key === 'ArrowUp' || event.key === 'ArrowLeft'
    if (!forward && !backward) return
    event.preventDefault()
    const focusedId = (event.target as HTMLElement)
      .closest<HTMLElement>('[data-profile-id]')
      ?.dataset.profileId
    const from =
      selectable.findIndex((option) => option.id === focusedId) !== -1
        ? selectable.findIndex((option) => option.id === focusedId)
        : selectable.findIndex((option) => option.id === selectedId)
    const nextIndex = (from + (forward ? 1 : -1) + selectable.length) % selectable.length
    const next = selectable[nextIndex]
    if (next === undefined) return
    setSelectedId(next.id)
    radioRefs.current.get(next.id)?.focus()
  }

  async function handleConfirm() {
    if (selectedId === null || busy) return
    if (selectedId === activeProfileId) {
      window.location.assign(target)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const response = await apiFetch(`/api/v1/profiles/${selectedId}/select`, {
        method: 'POST',
      })
      if (!response.ok) {
        let message = 'Profiili vahetamine ei õnnestunud. Proovi uuesti.'
        try {
          const body = (await response.json()) as { error?: unknown }
          if (typeof body.error === 'string' && body.error !== '') message = body.error
        } catch {
          // Keep the fallback copy.
        }
        setError(message)
        setBusy(false)
        return
      }
      // The select endpoint re-issues the access token cookie, so a full
      // navigation keeps server components in sync with the new active
      // profile (same rule as post-login routing).
      window.location.assign(target)
    } catch {
      setError('Võrguühendus ei ole saadaval. Proovi uuesti.')
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        role="radiogroup"
        aria-label="Profiilid"
        onKeyDown={handleKeyDown}
        className="flex flex-col gap-3.5"
      >
        {options.map((option) => (
          <ProfileCard
            key={option.id}
            option={option}
            grantedTypes={grantedTypes}
            checked={!option.disabled && selectedId === option.id}
            tabIndex={option.id === tabStopId ? 0 : -1}
            onChange={() => {
              setSelectedId(option.id)
            }}
            registerRef={registerRef(option.id)}
          />
        ))}
      </div>

      <Link
        href={registerHref}
        className="flex min-h-16 items-center justify-center gap-2.5 rounded-card border-2 border-dashed border-border bg-transparent font-label font-semibold text-primary transition-colors duration-hover ease-hover hover:bg-primaryLight motion-reduce:transition-none"
      >
        <Plus size={18} aria-hidden="true" />
        Lisa ettevõtte profiil
      </Link>

      {selected?.type === 'company' && (
        <div
          role="note"
          className="flex items-start gap-3 rounded-card border border-info bg-infoLight px-[18px] py-3.5"
        >
          <Info size={18} aria-hidden="true" className="mt-0.5 flex-none text-info" />
          <p className="m-0 text-[15px] text-ink">
            <span className="font-bold">
              Ettevõtte profiil kinnitatakse Erametsad poolt (äriregistri kontroll).
            </span>{' '}
            Saad teavituse, kui profiil on aktiveeritud.
          </p>
        </div>
      )}

      <div className="mt-2 flex items-center justify-center gap-3.5 max-md:bottom-3 max-md:sticky max-md:flex-wrap max-md:rounded-card max-md:bg-white/95 max-md:p-3 max-md:shadow-card">
        <Btn
          size="lg"
          onClick={() => void handleConfirm()}
          isLoading={busy}
          disabled={selectedId === null}
          className="max-md:flex-1"
        >
          Jätka <ArrowRight size={18} aria-hidden="true" />
        </Btn>
        <Link
          href={target}
          className="inline-flex min-h-12 items-center justify-center rounded-button px-6 font-label font-semibold text-inkMuted transition-colors duration-hover ease-hover hover:text-ink motion-reduce:transition-none"
        >
          Jäta vahele
        </Link>
      </div>

      {error !== null && (
        <p role="alert" className="text-bodySm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
