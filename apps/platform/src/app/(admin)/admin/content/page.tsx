import Link from 'next/link'

import { PageHeader } from '../../_components/PageHeader'
import { requireAdminRepositories } from '../../_lib/admin'

interface ContentSection {
  href: string
  label: string
  description: string
  count: number | null
}

export const metadata = { title: 'Sisu' }

export default async function AdminContentPage() {
  const { repositories } = await requireAdminRepositories()

  const [
    articles,
    pages,
    mediaAssets,
    faqCategories,
    faqItems,
    testimonials,
    partnerServices,
    legalDocuments,
    redirects,
    specialists,
    statistics,
  ] = await Promise.all([
    repositories.find({ collection: 'articles', pagination: false }),
    repositories.find({ collection: 'pages', pagination: false }),
    repositories.find({ collection: 'media', pagination: false }),
    repositories.find({ collection: 'faq-categories', pagination: false }),
    repositories.find({ collection: 'faq-items', pagination: false }),
    repositories.find({ collection: 'testimonials', pagination: false }),
    repositories.find({ collection: 'partner-services', pagination: false }),
    repositories.find({ collection: 'legal-documents', pagination: false }),
    repositories.find({ collection: 'redirects', pagination: false }),
    repositories.find({ collection: 'specialists', pagination: false }),
    repositories.find({ collection: 'statistics-snapshots', pagination: false }),
  ])

  const sections: ContentSection[] = [
    {
      href: '/admin/content/articles',
      label: 'Artiklid',
      description: 'Uudised ja ajaveebi postitused.',
      count: articles.docs.length,
    },
    {
      href: '/admin/content/pages',
      label: 'Lehed',
      description: 'Staatilised lehed ja nende paigutus.',
      count: pages.docs.length,
    },
    {
      href: '/admin/media',
      label: 'Meediakogu',
      description: 'Pildid ja PDF-failid R2 salvestusruumis.',
      count: mediaAssets.docs.length,
    },
    {
      href: '/admin/content/faq/categories',
      label: 'KKK kategooriad',
      description: 'Korduma kippuvate küsimuste rühmad.',
      count: faqCategories.docs.length,
    },
    {
      href: '/admin/content/faq/items',
      label: 'KKK küsimused',
      description: 'Korduma kippuvad küsimused ja vastused.',
      count: faqItems.docs.length,
    },
    {
      href: '/admin/content/testimonials',
      label: 'Tagasiside',
      description: 'Klientide tagasiside ja tsitaadid.',
      count: testimonials.docs.length,
    },
    {
      href: '/admin/content/partner-services',
      label: 'Partnerite teenused',
      description: 'Partnerite teenuste nimekiri.',
      count: partnerServices.docs.length,
    },
    {
      href: '/admin/content/legal-documents',
      label: 'Õigusdokumendid',
      description: 'Tingimused, privaatsus ja küpsised.',
      count: legalDocuments.docs.length,
    },
    {
      href: '/admin/content/redirects',
      label: 'Suunamised',
      description: 'Vanad URL-id suunatakse uutele.',
      count: redirects.docs.length,
    },
    {
      href: '/admin/content/specialists',
      label: 'Spetsialistid',
      description: 'Meeskonna spetsialistid ja kontaktid.',
      count: specialists.docs.length,
    },
    {
      href: '/admin/content/statistics',
      label: 'Statistika',
      description: 'Müügistatistika kuupäeva ja tüübi järgi.',
      count: statistics.docs.length,
    },
    {
      href: '/admin/content/settings',
      label: 'Seaded',
      description: 'Vahendustasu, käibemaks ja platvormi lipud.',
      count: null,
    },
  ]

  return (
    <div>
      <PageHeader
        title="Sisu"
        description="Kogu veebilehe sisu haldus: artiklid, lehed, KKK, tagasiside ja sätted."
      />
      <div className="mt-md grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="rounded-card border border-border bg-bgPage p-md shadow-card transition-colors duration-hover ease-hover hover:border-primary"
          >
            <p className="text-label font-semibold text-ink-muted">{section.label}</p>
            <p className="mt-xs font-mono text-count font-medium text-primaryDark">
              {section.count ?? '—'}
            </p>
            <p className="mt-xs text-bodySm text-ink-muted">{section.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
