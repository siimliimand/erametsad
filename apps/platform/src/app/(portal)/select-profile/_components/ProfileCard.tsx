'use client'

import { Btn } from '@erametsad/ui'
import Link from 'next/link'
import { useState, type ReactNode, type SVGProps } from 'react'

import type { AuctionObjectType } from '@/lib/data/schema'

// apps/platform does not declare lucide-react as a direct dependency, so the
// few icons needed here are vendored with Lucide geometry. Keep in sync with
// lucide-react when the dependency lands.
function Svg({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

function UserIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg className="h-6 w-6 shrink-0" {...props}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </Svg>
  )
}

function BuildingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg className="h-6 w-6 shrink-0" {...props}>
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      <path d="M10 6h4" />
      <path d="M10 10h4" />
      <path d="M10 14h4" />
      <path d="M10 18h4" />
    </Svg>
  )
}

function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg className="h-5 w-5 shrink-0" {...props}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </Svg>
  )
}

const OBJECT_TYPE_LABELS: Record<AuctionObjectType, string> = {
  raieoigus: 'Raieõigus',
  kinnistu: 'Kinnistu',
  kiire: 'Kiire oksjon',
  pakett: 'Pakett',
}

export interface ProfileOption {
  id: string
  type: 'private' | 'company'
  name: string
  regCode: string | null
  active: boolean
  disabled: boolean
  note: string | null
}

interface ProfileCardProps {
  option: ProfileOption
  grantedTypes: AuctionObjectType[]
  checked: boolean
  onChange: () => void
}

const cardBase =
  'relative flex flex-col items-start gap-xs rounded-card border p-sm text-left transition-all duration-hover ease-hover motion-reduce:transition-none'

function RightsSummary({ grantedTypes }: { grantedTypes: AuctionObjectType[] }): ReactNode {
  if (grantedTypes.length === 0) {
    return <span className="font-body text-bodySm text-inkMuted">Pakkujaõigused pole veel antud.</span>
  }
  return (
    <>
      {grantedTypes.map((objectType) => (
        <span
          key={objectType}
          className="inline-flex items-center gap-2xs rounded-pill bg-primaryLight px-2 py-0.5 text-label font-semibold text-primaryDark"
        >
          {OBJECT_TYPE_LABELS[objectType]} ✓
        </span>
      ))}
    </>
  )
}

export function ProfileCard({ option, grantedTypes, checked, onChange }: ProfileCardProps) {
  const TypeIcon = option.type === 'company' ? BuildingIcon : UserIcon

  return (
    <label
      className={`${cardBase} ${
        option.disabled
          ? 'cursor-not-allowed border-border bg-bgMist opacity-60'
          : checked
            ? 'border-primary bg-primaryLight ring-1 ring-primary'
            : 'cursor-pointer border-border bg-bgPage hover:border-primary'
      }`}
    >
      <input
        type="radio"
        name="active-profile"
        value={option.id}
        checked={checked}
        onChange={onChange}
        disabled={option.disabled}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-card ring-primary peer-focus-visible:ring-2"
      />
      <span className="flex w-full items-start justify-between gap-sm">
        <TypeIcon className={option.disabled || !checked ? 'text-inkMuted' : 'text-primary'} />
        {option.active && !option.disabled && (
          <span className="rounded-pill bg-primary px-2 py-0.5 text-label font-semibold text-inkInverse">
            AKTIIVNE
          </span>
        )}
      </span>
      <span className="font-label font-semibold text-ink">{option.name}</span>
      {option.regCode !== null && (
        <span className="font-body text-bodySm text-inkMuted">Registrikood {option.regCode}</span>
      )}
      <span className="flex flex-wrap gap-2xs">
        <RightsSummary grantedTypes={grantedTypes} />
      </span>
      {option.note !== null && (
        <span className="font-body text-bodySm text-inkMuted">{option.note}</span>
      )}
    </label>
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

  const target = next ?? '/'
  const registerHref = next ? `/register?next=${encodeURIComponent(next)}` : '/register'

  async function handleConfirm() {
    if (selectedId === null || busy) return
    if (selectedId === activeProfileId) {
      window.location.assign(target)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/v1/profiles/${selectedId}/select`, {
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
    <div className="flex flex-col gap-md">
      <div role="radiogroup" aria-label="Profiilid" className="grid gap-sm sm:grid-cols-2">
        {options.map((option) => (
          <ProfileCard
            key={option.id}
            option={option}
            grantedTypes={grantedTypes}
            checked={!option.disabled && selectedId === option.id}
            onChange={() => {
              setSelectedId(option.id)
            }}
          />
        ))}
      </div>

      <Link
        href={registerHref}
        className="flex items-center justify-center gap-2xs rounded-card border border-dashed border-border bg-bgPage p-sm font-label font-semibold text-primary transition-all duration-hover ease-hover hover:border-primary hover:bg-primaryLight motion-reduce:transition-none"
      >
        <PlusIcon />
        Lisa ettevõtte
      </Link>

      <Btn onClick={() => void handleConfirm()} isLoading={busy} disabled={selectedId === null}>
        Kinnita valik
      </Btn>

      {error !== null && (
        <p role="alert" className="text-bodySm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
