'use client'

import { Btn, FormInput } from '@eametsad/ui'
import { useState, type SVGProps } from 'react'

import { lookupCompany, type CompanyLookupResult } from './register-client'

const REG_CODE_RE = /^\d{8}$/

type LookupState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'found'; company: CompanyLookupResult }
  | { kind: 'not-found' }
  | { kind: 'error' }

// Inline Lucide-geometry icons; apps/platform does not declare lucide-react
// as a direct dependency (see login/_components/icons.tsx).
function UserIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function BuildingIcon(props: SVGProps<SVGSVGElement>) {
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
      <rect width="16" height="20" x="4" y="2" rx="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" />
    </svg>
  )
}

interface StepProfileTypeProps {
  onNext: (choice: {
    profileType: 'private' | 'company'
    company: { regCode: string; companyName: string } | null
  }) => void
  onRequestAccess: (company: CompanyLookupResult) => void
}

export function StepProfileType({ onNext, onRequestAccess }: StepProfileTypeProps) {
  const [choice, setChoice] = useState<'private' | 'company' | null>(null)
  const [regCode, setRegCode] = useState('')
  const [regCodeError, setRegCodeError] = useState<string | null>(null)
  const [lookup, setLookup] = useState<LookupState>({ kind: 'idle' })
  const [companyName, setCompanyName] = useState('')
  const [companyNameError, setCompanyNameError] = useState<string | null>(null)

  async function handleLookup() {
    const code = regCode.trim()
    if (!REG_CODE_RE.test(code)) {
      setRegCodeError('Sisesta 8-kohaline registrikood.')
      return
    }
    setRegCodeError(null)
    setLookup({ kind: 'loading' })
    const result = await lookupCompany(code)
    if (result.ok) {
      setLookup({ kind: 'found', company: result.company })
    } else {
      setLookup(result.reason === 'not-found' ? { kind: 'not-found' } : { kind: 'error' })
    }
  }

  function handleContinue() {
    if (choice === 'private') {
      onNext({ profileType: 'private', company: null })
      return
    }
    if (choice === 'company' && lookup.kind === 'not-found') {
      const name = companyName.trim()
      if (!name) {
        setCompanyNameError('Sisesta ettevõtte nimi.')
        return
      }
      setCompanyNameError(null)
      onNext({
        profileType: 'company',
        company: { regCode: regCode.trim(), companyName: name },
      })
    }
  }

  const options: { value: 'private' | 'company'; label: string; hint: string; Icon: typeof UserIcon }[] = [
    {
      value: 'private',
      label: 'Eraisik',
      hint: 'Isiklik konto oksjonitel osalemiseks',
      Icon: UserIcon,
    },
    {
      value: 'company',
      label: 'Ettevõte',
      hint: 'Ettevõtte konto oma objektide müümiseks',
      Icon: BuildingIcon,
    },
  ]

  return (
    <section aria-label="Profiili tüüp" className="mt-md flex flex-col gap-md">
      <div className="flex flex-col gap-2xs">
        <h2 className="font-heading text-h3 text-ink">Vali profiili tüüp</h2>
        <p className="font-body text-body text-inkMuted">
          Kas osaled oksjonitel eraisikuna või müüd ettevõtte nimel?
        </p>
      </div>

      <div role="group" aria-label="Profiili tüübid" className="grid gap-sm sm:grid-cols-2">
        {options.map(({ value, label, hint, Icon }) => {
          const isSelected = choice === value
          return (
            <button
              key={value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => {
                setChoice(value)
                setLookup({ kind: 'idle' })
                setCompanyNameError(null)
              }}
              className={`flex flex-col items-start gap-2xs rounded-card border p-sm text-left transition-all duration-hover ease-hover motion-reduce:transition-none ${
                isSelected
                  ? 'border-primary bg-primaryLight ring-1 ring-primary'
                  : 'border-border bg-bgPage hover:border-primary'
              }`}
            >
              <Icon
                className={`h-6 w-6 ${isSelected ? 'text-primary' : 'text-inkMuted'}`}
                aria-hidden="true"
              />
              <span className="font-label font-semibold text-ink">{label}</span>
              <span className="font-body text-bodySm text-inkMuted">{hint}</span>
            </button>
          )
        })}
      </div>

      {choice === 'company' && (
        <div className="flex flex-col gap-sm">
          <FormInput
            label="Registrikood"
            name="company-regcode"
            inputMode="numeric"
            maxLength={8}
            autoComplete="off"
            hint="8-kohaline e-Äriregistri kood"
            {...(regCodeError ? { error: regCodeError } : {})}
            value={regCode}
            onChange={(event) => {
              setRegCode(event.target.value)
              setLookup({ kind: 'idle' })
            }}
          />

          <Btn
            variant="outline"
            onClick={() => void handleLookup()}
            disabled={lookup.kind === 'loading'}
            isLoading={lookup.kind === 'loading'}
          >
            Otsi ettevõtet
          </Btn>

          {lookup.kind === 'error' && (
            <p role="alert" className="font-body text-bodySm text-danger">
              Otsing ei õnnestunud. Proovi uuesti.
            </p>
          )}

          {lookup.kind === 'found' && (
            <div className="flex flex-col gap-sm rounded-card border border-border bg-bgMist p-sm">
              <div>
                <p className="font-label font-semibold uppercase tracking-wide text-ink">
                  {lookup.company.name}
                </p>
                <p className="font-body text-bodySm text-inkMuted">
                  Registrikood {lookup.company.regCode}
                </p>
              </div>
              <div>
                <p className="font-label font-semibold text-ink">Juhatuse liikmed</p>
                <ul className="mt-2xs list-inside list-disc font-body text-bodySm text-inkMuted">
                  {lookup.company.boardMembers.map((member) => (
                    <li key={`${member.name}-${member.role}`}>
                      {member.name} ({member.role})
                    </li>
                  ))}
                </ul>
              </div>
              <p className="font-body text-bodySm text-ink">
                See ettevõte on juba oksjonikeskkonnas. Uue profiili asemel taotle
                olemasolevale ettevõtte profiilile juurdepääsu.
              </p>
              <Btn onClick={() => { onRequestAccess(lookup.company); }}>
                Taotle juurdepääsu
              </Btn>
            </div>
          )}

          {lookup.kind === 'not-found' && (
            <div className="flex flex-col gap-sm">
              <p className="font-body text-bodySm text-inkMuted">
                Ettevõtet registrist ei leitud. Sisesta ettevõtte nimi käsitsi.
              </p>
              <FormInput
                label="Ettevõtte nimi"
                name="company-name"
                autoComplete="organization"
                {...(companyNameError ? { error: companyNameError } : {})}
                value={companyName}
                onChange={(event) => {
                  setCompanyName(event.target.value)
                }}
              />
            </div>
          )}
        </div>
      )}

      {(choice === 'private' || (choice === 'company' && lookup.kind === 'not-found')) && (
        <Btn onClick={handleContinue}>Jätka</Btn>
      )}
    </section>
  )
}
