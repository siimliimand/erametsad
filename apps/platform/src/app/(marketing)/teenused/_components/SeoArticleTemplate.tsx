import { LeadForm, StickyTOC, type TOCSection } from '@eametsad/ui'

import { HomeTicker, type TickerLotSummary } from '../../_components/HomeTicker'

import { PORTAL_HOSTNAME } from '@/lib/routing/host-areas'

export interface SeoArticleSection {
  id: string
  heading: string
  paragraphs: string[]
}

export interface SeoArticleTemplateProps {
  title: string
  intro: string
  leadFormHeading: string
  closingFormHeading: string
  leadSlug: string
  tickerLots: TickerLotSummary[]
  sections: SeoArticleSection[]
  ctaHeading: string
  ctaText: string
  ctaButtonLabel: string
}

const ctaButtonClass =
  'inline-flex h-12 items-center justify-center rounded-button bg-cta px-6 font-label font-semibold text-ink transition-colors duration-hover ease-hover hover:bg-ctaHover motion-reduce:transition-none'

const leadFormSectionClass =
  'mx-auto max-w-container-xl scroll-mt-28 px-md lg:scroll-mt-20 md:px-lg'

// SEO-article template (docs/design/marketing/04, "SEO-artikli mall"):
// hero -> ticker -> LeadForm -> article body with StickyTOC -> CTA band ->
// LeadForm. Instances pass their own copy, sections and lead slug; ticker
// data stays a server-side concern of the page.
export function SeoArticleTemplate({
  title,
  intro,
  leadFormHeading,
  closingFormHeading,
  leadSlug,
  tickerLots,
  sections,
  ctaHeading,
  ctaText,
  ctaButtonLabel,
}: SeoArticleTemplateProps) {
  const tocSections: TOCSection[] = sections.map(({ id, heading }) => ({
    id,
    title: heading,
  }))

  return (
    <>
      {/* 1. Hero — bg-mist variant of the design doc; the photo arrives with CMS content */}
      <section className="bg-bgMist">
        <div className="mx-auto max-w-container-xl px-md py-xl md:px-lg">
          <h1 className="max-w-container-sm font-heading text-h1 text-ink">
            {title}
          </h1>
          <p className="mt-md max-w-container-sm text-body text-inkMuted">
            {intro}
          </p>
        </div>
      </section>

      {/* 2. AuctionTicker — same block as the home page (doc 04 block 2) */}
      <section className="mx-auto max-w-container-xl px-md py-xl md:px-lg">
        <div className="flex flex-wrap items-baseline justify-between gap-md">
          <h2 className="font-heading text-h2 text-ink">Aktiivsed oksjonid</h2>
          <a
            href={`https://${PORTAL_HOSTNAME}`}
            className="font-semibold text-primary underline hover:text-primaryHover"
          >
            Kõik oksjonid
          </a>
        </div>
        <div className="mt-md">
          <HomeTicker initialLots={tickerLots} />
        </div>
      </section>

      {/* 3. LeadForm #1 (#kontaktvorm) */}
      <section id="kontaktvorm" className={leadFormSectionClass}>
        <div className="rounded-card bg-bgMist p-lg">
          <h2 className="max-w-container-sm font-heading text-h3 text-ink">
            {leadFormHeading}
          </h2>
          <div className="mt-md max-w-container-sm">
            <LeadForm slug={leadSlug} />
          </div>
        </div>
      </section>

      {/* 4. Article body with StickyTOC; H2 ids double as TOC anchors */}
      <section className="mx-auto max-w-container-xl px-md py-xl md:px-lg">
        <div className="grid gap-gutter lg:grid-cols-12">
          <aside className="lg:order-2 lg:col-span-4" aria-label="Artikli sisukord">
            <StickyTOC sections={tocSections} className="lg:pl-md" />
          </aside>
          <div className="lg:order-1 lg:col-span-8">
            {sections.map(({ id, heading, paragraphs }) => (
              <div key={id} className="mt-lg first:mt-0">
                <h2
                  id={id}
                  className="scroll-mt-28 font-heading text-h2 text-ink lg:scroll-mt-20"
                >
                  {heading}
                </h2>
                {paragraphs.map((paragraph, index) => (
                  <p
                    key={`${id}-${String(index)}`}
                    className="mt-sm max-w-container-sm text-body text-inkMuted"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. CTA band — primary-dark surface, button anchors LeadForm #2 */}
      <div className="mx-auto max-w-container-xl px-md md:px-lg">
        <section
          aria-label="Konsultatsioon"
          className="rounded-card bg-primaryDark p-md md:p-lg"
        >
          <h2 className="font-heading text-h2 text-inkInverse">{ctaHeading}</h2>
          <p className="mt-xs max-w-container-sm text-body text-white/90">
            {ctaText}
          </p>
          <a href="#kontaktvorm-2" className={`mt-md ${ctaButtonClass}`}>
            {ctaButtonLabel}
          </a>
        </section>
      </div>

      {/* 6. LeadForm #2 (#kontaktvorm-2) */}
      <section id="kontaktvorm-2" className={`${leadFormSectionClass} py-xl`}>
        <div className="rounded-card bg-bgMist p-lg">
          <h2 className="max-w-container-sm font-heading text-h3 text-ink">
            {closingFormHeading}
          </h2>
          <div className="mt-md max-w-container-sm">
            <LeadForm slug={leadSlug} />
          </div>
        </div>
      </section>
    </>
  )
}
