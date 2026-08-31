import { EmptyState } from '@eametsad/ui'
import { FileText, Scale } from 'lucide-react'
import type { Metadata } from 'next'

import { VersionNotifyForm } from '../_components/VersionNotifyForm'

import { getRepositories } from '@/lib/data/runtime'
import type { LegalDocument, LegalDocumentType } from '@/lib/data/schema'

// DB-backed marketing pages render at request time (see kkk/page.tsx):
// CI and deploy builds run `next build` without a seeded D1, so
// prerendering against the CMS would fail the build or bake empty pages.
// Drop `force-dynamic` and add ISR once build-time D1 seeding exists.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Lepingute mallid',
  description:
    'Oksjoni- ja müügilepingute mallid koos versioonidega — liitu teavitusega, kui mall uueneb.',
  alternates: { canonical: '/lepingud/dokumendid' },
}

// Mirrors (admin)/_lib/labels.tsx; keyed by the schema's LegalDocumentType
// so a schema change fails the typecheck here. Admin's map is not imported
// across route groups.
const TYPE_LABELS: Record<LegalDocumentType, string> = {
  terms: 'Kasutustingimused',
  privacy: 'Privaatsuspoliitika',
  cookies: 'Küpsiste poliitika',
  contract: 'Leping',
}

function typeLabel(doc: LegalDocument): string {
  return doc.type ? TYPE_LABELS[doc.type] : 'Muud'
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const datePart = iso.split('T')[0] ?? ''
  const [year, month, day] = datePart.split('-')
  return day && month && year ? `${day}.${month}.${year}` : '—'
}

export default async function DokumendidPage() {
  const repos = await getRepositories()
  const { docs } = await repos.find({
    collection: 'legal-documents',
    where: { status: { equals: 'published' } },
    sort: '-effectiveDate',
    pagination: false,
  })

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: docs.map((doc, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: doc.title,
    })),
  }

  return (
    <main className="mx-auto w-full max-w-container-xl px-md py-lg">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <h1 className="font-heading text-h1 text-ink">Lepingute mallid</h1>
      <p className="mt-xs max-w-container-sm text-body text-inkMuted">
        Kõik oksjoniprotsessi lepingud on avalikud — loe enne registreerumist
        rahulikult läbi. Kehtiv versioon kehtestatakse oksjoni alguseks.
      </p>

      {docs.length === 0 ? (
        <div className="mt-lg">
          <EmptyState
            icon={FileText}
            title="Mallid lisanduvad enne esimest oksjonit"
            description="Saadame teate, kui mall uueneb — liitu allpool teavitusega."
          />
        </div>
      ) : (
        <section aria-label="Lepingute mallide loend" className="mt-lg">
          {/* Desktop column header; rows collapse to cards on mobile. */}
          <div className="hidden gap-md border-b border-border px-md pb-xs text-bodySm font-semibold text-inkMuted md:grid md:grid-cols-[1fr_12rem_6rem_8rem]">
            <span>Dokument</span>
            <span>Tüüp</span>
            <span>Versioon</span>
            <span>Kuupäev</span>
          </div>
          <ul className="flex flex-col gap-sm">
            {docs.map((doc) => (
              <li
                key={doc.id}
                className="grid gap-xs rounded-card border border-border p-md md:grid-cols-[1fr_12rem_6rem_8rem] md:items-center md:gap-md"
              >
                <span className="font-semibold text-ink">{doc.title}</span>
                <span className="text-body text-inkMuted">
                  <span className="md:hidden">Tüüp: </span>
                  {typeLabel(doc)}
                </span>
                <span className="text-body text-inkMuted">
                  <span className="md:hidden">Versioon: </span>
                  {doc.version ?? '—'}
                </span>
                <span className="text-body text-inkMuted">
                  <span className="md:hidden">Kuupäev: </span>
                  {formatDate(doc.effectiveDate)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section
        aria-labelledby="versiooniteavitus"
        className="mt-lg rounded-card border border-border bg-bgMist p-md"
      >
        <h2 id="versiooniteavitus" className="font-heading text-h3 text-ink">
          Uue versiooni puhul
        </h2>
        <p className="mt-xs text-body text-inkMuted">
          Saadame teate, kui mall uueneb.
        </p>
        <div className="mt-sm max-w-md">
          <VersionNotifyForm />
        </div>
      </section>

      <div className="mt-md flex items-start gap-sm rounded-card border border-border bg-bgMist p-md text-body text-inkMuted">
        <Scale className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <p>
          Mallid on näidised — oksjonil osalemiseks kehtib allkirjastatud
          leping.
        </p>
      </div>
    </main>
  )
}
