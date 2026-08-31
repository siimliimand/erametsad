import { Landmark } from 'lucide-react'

// Fields the design doc (13-meist.md block 2) puts on the official company
// info card. Settings currently stores only orgName/orgRegCode/orgAddress,
// so KMKR, phone and email stay optional until the schema gains columns.
export interface CompanyCardProps {
  orgName?: string | undefined
  orgRegCode?: string | undefined
  vatNumber?: string | undefined
  orgAddress?: string | undefined
  phone?: string | undefined
  email?: string | undefined
}

interface CompanyCardRow {
  label: string
  value: string
  href?: string
  mono?: boolean
}

function companyCardRows(props: CompanyCardProps): CompanyCardRow[] {
  const rows: CompanyCardRow[] = []
  if (props.orgRegCode) {
    rows.push({ label: 'Registrikood', value: props.orgRegCode, mono: true })
  }
  if (props.vatNumber) {
    rows.push({ label: 'Käibemaksukohustuslase nr', value: props.vatNumber, mono: true })
  }
  if (props.orgAddress) {
    rows.push({ label: 'Aadress', value: props.orgAddress })
  }
  if (props.phone) {
    rows.push({
      label: 'Telefon',
      value: props.phone,
      href: `tel:${props.phone.replace(/\s+/g, '')}`,
      mono: true,
    })
  }
  if (props.email) {
    rows.push({ label: 'E-mail', value: props.email, href: `mailto:${props.email}` })
  }
  return rows
}

export function CompanyCard(props: CompanyCardProps) {
  const rows = companyCardRows(props)
  return (
    <div className="rounded-card bg-bgMist p-6 shadow-card">
      <div className="flex items-center gap-sm">
        <Landmark className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        {props.orgName && <h2 className="font-heading text-h3 text-ink">{props.orgName}</h2>}
      </div>
      {rows.length > 0 && (
        <dl className="mt-md flex flex-col gap-xs">
          {rows.map((row) => (
            <div key={row.label} className="flex flex-col gap-0.5 sm:flex-row sm:gap-md">
              <dt className="shrink-0 font-body text-label text-inkMuted sm:w-56 sm:pt-0.5">
                {row.label}
              </dt>
              <dd className="font-body text-bodySm text-ink">
                {row.href ? (
                  <a
                    href={row.href}
                    className={`transition-colors duration-hover ease-hover hover:text-primaryHover ${
                      row.mono ? 'font-mono' : ''
                    }`}
                  >
                    {row.value}
                  </a>
                ) : (
                  <span className={row.mono ? 'font-mono' : undefined}>{row.value}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
