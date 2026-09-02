'use client'

import {
  Btn,
  Card,
  StatusPill,
  Countdown,
  Accordion,
  Tabs,
  Modal,
  Drawer,
  Toast,
  EmptyState,
  DataTable,
  Steps,
  ChipNav,
  FormInput,
  FormSelect,
  FormCheck,
  ConsentCheck,
  FormRange,
  FormFile,
  LotCard,
  AuctionTicker,
  SpecialistCard,
  ContactBand,
  Testimonial,
  ArticleCard,
  DocumentLink,
  FilterPanel,
  StickyTOC,
  SearchableAccordion,
  LeadForm,
} from '@erametsad/ui'
import dynamic from 'next/dynamic'
import { notFound } from 'next/navigation'
import { Suspense, useState, useCallback } from 'react'

import '../../../../../packages/ui/src/styles/tokens.css'

const MapEstonia = dynamic(
  () => import('@erametsad/ui').then((m) => ({ default: m.MapEstonia })),
  { ssr: false },
)

function noop() {
  // noop
}

if (process.env.NODE_ENV === 'production') {
  notFound()
}

const colorSwatches = [
  { label: 'Primary', var: '--color-primary' },
  { label: 'Primary Hover', var: '--color-primary-hover' },
  { label: 'Primary Dark', var: '--color-primary-dark' },
  { label: 'Primary Light', var: '--color-primary-light' },
  { label: 'Accent', var: '--color-accent' },
  { label: 'CTA', var: '--color-cta' },
  { label: 'CTA Hover', var: '--color-cta-hover' },
  { label: 'Ink', var: '--color-ink' },
  { label: 'Ink Muted', var: '--color-ink-muted' },
  { label: 'Ink Inverse', var: '--color-ink-inverse' },
  { label: 'Bg Page', var: '--color-bg-page' },
  { label: 'Bg Mist', var: '--color-bg-mist' },
  { label: 'Border', var: '--color-border' },
  { label: 'Danger', var: '--color-danger' },
  { label: 'Danger Light', var: '--color-danger-light' },
  { label: 'Info', var: '--color-info' },
  { label: 'Info Light', var: '--color-info-light' },
  { label: 'Status Active', var: '--color-status-active' },
  { label: 'Status Ending Soon', var: '--color-status-ending-soon' },
  { label: 'Status Critical', var: '--color-status-critical' },
  { label: 'Status Ended', var: '--color-status-ended' },
  { label: 'Status Draft', var: '--color-status-draft' },
  { label: 'Status Scheduled', var: '--color-status-scheduled' },
]

const spacingSteps = [
  { label: '2xs', var: '--space-2xs' },
  { label: 'xs', var: '--space-xs' },
  { label: 'sm', var: '--space-sm' },
  { label: 'md', var: '--space-md' },
  { label: 'lg', var: '--space-lg' },
  { label: 'xl', var: '--space-xl' },
  { label: '2xl', var: '--space-2xl' },
  { label: '3xl', var: '--space-3xl' },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-xl">
      <h2 className="mb-md font-heading text-h2 text-ink">{title}</h2>
      <div className="rounded-card border border-border bg-bgPage p-md shadow-card">
        {children}
      </div>
    </section>
  )
}

function TokenSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-lg">
      <h3 className="mb-sm font-heading text-h3 text-ink">{title}</h3>
      {children}
    </div>
  )
}

export default function StyleguidePage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [toastState, setToastState] = useState<{ message: string; type: 'success' | 'error' | 'info'; visible: boolean } | null>(null)
  const [chipActive, setChipActive] = useState('all')

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    setToastState({ message, type, visible: true })
  }, [])

  const hideToast = useCallback(() => {
    setToastState((prev) => (prev ? { ...prev, visible: false } : null))
  }, [])

  const futureDate = (minutesFromNow: number) =>
    new Date(Date.now() + minutesFromNow * 60 * 1000).toISOString()

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-xl">
      <h1 className="mb-xl font-heading text-h1 text-ink">Styleguide</h1>

      {/* ── Tokens ── */}
      <Section title="Tokens">
        <TokenSection title="Colors">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {colorSwatches.map((c) => (
              <div key={c.var} className="flex flex-col gap-1">
                <div
                  className="h-12 rounded-card border border-border"
                  style={{ backgroundColor: `var(${c.var})` }}
                />
                <span className="text-label text-ink">{c.label}</span>
                <code className="text-[10px] text-ink-muted">{c.var}</code>
              </div>
            ))}
          </div>
        </TokenSection>

        <TokenSection title="Spacing">
          <div className="flex flex-col gap-3">
            {spacingSteps.map((s) => (
              <div key={s.var} className="flex items-center gap-4">
                <span className="w-16 text-label text-ink">{s.label}</span>
                <div
                  className="h-4 rounded bg-primary"
                  style={{ width: `var(${s.var})` }}
                />
                <code className="text-label text-ink-muted">{s.var}</code>
              </div>
            ))}
          </div>
        </TokenSection>

        <TokenSection title="Shadows">
          <div className="flex flex-wrap gap-md">
            <div className="flex h-24 w-40 items-center justify-center rounded-card" style={{ boxShadow: 'var(--shadow-card)' }}>
              <span className="text-label text-ink">card</span>
            </div>
            <div className="flex h-24 w-40 items-center justify-center rounded-card" style={{ boxShadow: 'var(--shadow-card-hover)' }}>
              <span className="text-label text-ink">card-hover</span>
            </div>
            <div className="flex h-24 w-40 items-center justify-center rounded-card" style={{ boxShadow: 'var(--shadow-modal)' }}>
              <span className="text-label text-ink">modal</span>
            </div>
          </div>
        </TokenSection>

        <TokenSection title="Type Scale">
          <div className="flex flex-col gap-2">
            <p className="font-heading text-h1 text-ink">H1 – Manrope 800</p>
            <p className="font-heading text-h2 text-ink">H2 – Manrope 700</p>
            <p className="font-heading text-h3 text-ink">H3 – Manrope 700</p>
            <p className="font-heading text-h4 text-ink">H4 – Manrope 700</p>
            <p className="font-body text-body text-ink">Body – Inter 400</p>
            <p className="font-body text-bodySm text-ink-muted">BodySm – Inter 500</p>
            <p className="text-label text-ink-muted">Label – Inter 600</p>
            <p className="font-mono text-h4 text-ink" style={{ fontFeatureSettings: '"tnum" 1' }}>Mono – 123 456</p>
          </div>
        </TokenSection>
      </Section>

      {/* ── Btn ── */}
      <Section title="Btn">
        <div className="flex flex-col gap-6">
          <div>
            <h3 className="mb-2 font-heading text-h4 text-ink">Variants</h3>
            <div className="flex flex-wrap gap-3">
              <Btn variant="primary">Primary</Btn>
              <Btn variant="cta">CTA</Btn>
              <Btn variant="outline">Outline</Btn>
              <Btn variant="ghost">Ghost</Btn>
            </div>
          </div>
          <div>
            <h3 className="mb-2 font-heading text-h4 text-ink">Sizes</h3>
            <div className="flex flex-wrap items-center gap-3">
              <Btn size="sm">Small</Btn>
              <Btn size="md">Medium</Btn>
              <Btn size="lg">Large</Btn>
            </div>
          </div>
          <div>
            <h3 className="mb-2 font-heading text-h4 text-ink">States</h3>
            <div className="flex flex-wrap gap-3">
              <Btn isLoading>Loading</Btn>
              <Btn disabled>Disabled</Btn>
            </div>
          </div>
        </div>
      </Section>

      {/* ── Card ── */}
      <Section title="Card">
        <div className="flex flex-wrap gap-md">
          <Card
            className="w-72"
            image={
              <div className="aspect-[16/9] rounded-card bg-bg-mist flex items-center justify-center">
                <span className="text-ink-muted">Image slot</span>
              </div>
            }
            content={
              <div>
                <h3 className="font-heading text-h4 text-ink">With Hover</h3>
                <p className="mt-1 text-body text-ink-muted">Content slot with hover effect.</p>
              </div>
            }
            actions={<Btn size="sm">Action</Btn>}
            hover
          />
          <Card
            className="w-72"
            content={
              <div>
                <h3 className="font-heading text-h4 text-ink">No Hover</h3>
                <p className="mt-1 text-body text-ink-muted">No hover effect enabled.</p>
              </div>
            }
            hover={false}
          />
        </div>
      </Section>

      {/* ── StatusPill ── */}
      <Section title="StatusPill">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-3 items-center">
            <StatusPill status="active" />
            <StatusPill status="endingSoon" />
            <StatusPill status="critical" />
            <StatusPill status="ended" />
            <StatusPill status="draft" />
            <StatusPill status="scheduled" />
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <StatusPill status="active" size="sm" />
            <StatusPill status="endingSoon" size="sm" />
            <StatusPill status="critical" size="sm" />
            <StatusPill status="ended" size="sm" />
            <StatusPill status="draft" size="sm" />
            <StatusPill status="scheduled" size="sm" />
          </div>
        </div>
      </Section>

      {/* ── Countdown ── */}
      <Section title="Countdown">
        <div className="flex flex-col gap-4">
          <Countdown endsAt={futureDate(120)} showLabel size="md" />
          <Countdown endsAt={futureDate(45)} showLabel size="md" />
          <Countdown endsAt={futureDate(3)} showLabel size="md" />
          <Countdown endsAt={new Date(Date.now() - 60000).toISOString()} showLabel size="md" />
        </div>
      </Section>

      {/* ── Accordion ── */}
      <Section title="Accordion">
        <div className="flex flex-col gap-6">
          <div>
            <h3 className="mb-2 font-heading text-h4 text-ink">Single (FAQ)</h3>
            <Accordion
              variant="single"
              items={[
                { id: 'faq1', title: 'Kuidas oksjonil osaleda?', content: <p>Registreeri kasutaja ja tee pakkumine.</p> },
                { id: 'faq2', title: 'Millised on tasud?', content: <p>Eduka pakkumise korral 3% + km.</p> },
              ]}
            />
          </div>
          <div>
            <h3 className="mb-2 font-heading text-h4 text-ink">Multi (Process)</h3>
            <Accordion
              variant="multi"
              items={[
                { id: 'step1', title: 'Samm 1', content: <p>Esimene samm protsessis.</p> },
                { id: 'step2', title: 'Samm 2', content: <p>Teine samm protsessis.</p> },
              ]}
            />
          </div>
        </div>
      </Section>

      {/* ── Tabs ── */}
      <Section title="Tabs">
        <div className="flex flex-col gap-6">
          <div>
            <h3 className="mb-2 font-heading text-h4 text-ink">With badge counts</h3>
            <Tabs
              tabs={[
                { id: 'tab1', label: 'Aktiivsed', count: 12, content: <p>Aktiivsed oksjonid</p> },
                { id: 'tab2', label: 'Tulevased', count: 5, content: <p>Tulevased oksjonid</p> },
              ]}
            />
          </div>
          <div>
            <h3 className="mb-2 font-heading text-h4 text-ink">Without counts</h3>
            <Tabs
              tabs={[
                { id: 'a', label: 'Info', content: <p>Info vaade</p> },
                { id: 'b', label: 'Detailid', content: <p>Detailide vaade</p> },
              ]}
            />
          </div>
        </div>
      </Section>

      {/* ── Modal ── */}
      <Section title="Modal">
        <Btn onClick={() => { setModalOpen(true); }}>Ava modaal</Btn>
        <Modal isOpen={modalOpen} onClose={function () { setModalOpen(false); }} title="Modaal">
          <p>See on modaali sisu.</p>
        </Modal>
      </Section>

      {/* ── Drawer ── */}
      <Section title="Drawer">
        <Btn onClick={() => { setDrawerOpen(true); }}>Ava drawer</Btn>
        <Drawer isOpen={drawerOpen} onClose={function () { setDrawerOpen(false); }} title="Drawer">
          <p>See on drawer'i sisu.</p>
        </Drawer>
      </Section>

      {/* ── Toast ── */}
      <Section title="Toast">
        <div className="flex flex-wrap gap-3">
          <Btn onClick={() => { showToast('Edukalt salvestatud', 'success'); }}>Success</Btn>
          <Btn onClick={() => { showToast('Tekkis viga', 'error'); }}>Error</Btn>
          <Btn onClick={() => { showToast('Teavituse info', 'info'); }}>Info</Btn>
        </div>
        {toastState && (
          <Toast
            message={toastState.message}
            type={toastState.type}
            isVisible={toastState.visible}
            onClose={hideToast}
          />
        )}
      </Section>

      {/* ── EmptyState ── */}
      <Section title="EmptyState">
        <div className="flex flex-wrap gap-md">
          <div className="w-80">
            <EmptyState title="With icon" description="Kirjeldus tekstiga" icon={() => null} />
          </div>
          <div className="w-80">
            <EmptyState title="Without icon" description="Ainult tekst ja kirjeldus" />
          </div>
          <div className="w-80">
            <EmptyState
              title="With action"
              description="Vajuta nuppu alustamiseks"
              action={<Btn>Alusta</Btn>}
            />
          </div>
        </div>
      </Section>

      {/* ── DataTable ── */}
      <Section title="DataTable">
        <div className="flex flex-col gap-6">
          <div>
            <h3 className="mb-2 font-heading text-h4 text-ink">With data</h3>
            <DataTable
              columns={[
                { key: 'name', label: 'Nimi', sortable: true },
                { key: 'value', label: 'Väärtus', sortable: true },
              ]}
              data={[
                { name: 'Esimene', value: 100 },
                { name: 'Teine', value: 200 },
              ]}
            />
          </div>
          <div>
            <h3 className="mb-2 font-heading text-h4 text-ink">Loading</h3>
            <DataTable
              columns={[
                { key: 'name', label: 'Nimi' },
                { key: 'value', label: 'Väärtus' },
              ]}
              data={[]}
              isLoading
            />
          </div>
          <div>
            <h3 className="mb-2 font-heading text-h4 text-ink">Empty</h3>
            <DataTable
              columns={[
                { key: 'name', label: 'Nimi' },
                { key: 'value', label: 'Väärtus' },
              ]}
              data={[]}
              emptyState={<p>Andmed puuduvad</p>}
            />
          </div>
          <div>
            <h3 className="mb-2 font-heading text-h4 text-ink">With pagination</h3>
            <DataTable
              columns={[
                { key: 'name', label: 'Nimi' },
                { key: 'value', label: 'Väärtus' },
              ]}
              data={[
                { name: 'Esimene', value: 100 },
                { name: 'Teine', value: 200 },
              ]}
              page={1}
              totalPages={3}
            />
          </div>
        </div>
      </Section>

      {/* ── Steps ── */}
      <Section title="Steps">
        <div className="flex flex-col gap-6">
          <div>
            <h3 className="mb-2 font-heading text-h4 text-ink">Numbered horizontal</h3>
            <Steps
              orientation="horizontal"
              steps={[
                { id: 's1', label: 'Registreeri', status: 'completed' },
                { id: 's2', label: 'Kinnita', status: 'current' },
                { id: 's3', label: 'Valmis', status: 'upcoming' },
              ]}
            />
          </div>
          <div>
            <h3 className="mb-2 font-heading text-h4 text-ink">Emphasis vertical</h3>
            <Steps
              variant="emphasis"
              orientation="vertical"
              steps={[
                { id: 'v1', label: 'Esimene', description: 'Esimene samm', status: 'completed' },
                { id: 'v2', label: 'Teine', description: 'Teine samm', status: 'current' },
                { id: 'v3', label: 'Kolmas', description: 'Kolmas samm', status: 'upcoming' },
              ]}
            />
          </div>
        </div>
      </Section>

      {/* ── ChipNav ── */}
      <Section title="ChipNav">
        <ChipNav
          items={[
            { id: 'all', label: 'Kõik', count: 42 },
            { id: 'active', label: 'Aktiivsed', count: 12 },
            { id: 'ended', label: 'Lõppenud', count: 30 },
          ]}
          activeId={chipActive}
          onChange={setChipActive}
        />
      </Section>

      {/* ── FormInput / FormSelect / FormCheck ── */}
      <Section title="FormInput">
        <div className="flex flex-col gap-4 max-w-md">
          <FormInput name="default" label="Tavaline" />
          <FormInput name="with-value" label="Täidetud" defaultValue="Tekst" />
          <FormInput name="error" label="Vigane" error="See väli on kohustuslik" />
          <FormInput name="hint" label="Vihjega" hint="Sisesta oma nimi" />
          <FormInput name="disabled" label="Keelatud" disabled />
        </div>
      </Section>

      <Section title="FormSelect">
        <div className="flex flex-col gap-4 max-w-md">
          <FormSelect name="default" label="Tavaline" options={[{ value: '1', label: 'Valik 1' }, { value: '2', label: 'Valik 2' }]} placeholder="Vali..." />
          <FormSelect name="error-sel" label="Vigane" options={[{ value: '1', label: 'Valik 1' }]} error="Viga valikus" />
          <FormSelect name="hint-sel" label="Vihjega" options={[{ value: '1', label: 'Valik 1' }]} hint="Vali sobiv" />
          <FormSelect name="disabled-sel" label="Keelatud" options={[{ value: '1', label: 'Valik 1' }]} disabled />
        </div>
      </Section>

      <Section title="FormCheck">
        <div className="flex flex-col gap-4 max-w-md">
          <FormCheck name="check1" label="Nõustun tingimustega" />
          <FormCheck name="check2" label="Vigane" error="See väli on kohustuslik" />
          <FormCheck name="check3" label="Vihjega" hint="Märgi see linnuke" />
          <FormCheck name="check4" label="Keelatud" disabled />
        </div>
      </Section>

      {/* ── ConsentCheck ── */}
      <Section title="ConsentCheck">
        <ConsentCheck name="consent" label="Nõustun isikuandmete töötlemisega" />
      </Section>

      {/* ── FormRange ── */}
      <Section title="FormRange">
        <div className="max-w-md">
          <FormRange name="range1" label="Hinnavahemik" min={0} max={100000} step={1000} value={[10000, 50000]} onChange={noop} />
        </div>
      </Section>

      {/* ── FormFile ── */}
      <Section title="FormFile">
        <div className="max-w-md">
          <FormFile name="file" label="Lae fail" onChange={noop} />
        </div>
      </Section>

      {/* ── LotCard ── */}
      <Section title="LotCard">
        <div className="flex flex-wrap gap-md">
          <div className="w-72">
            <LotCard
              title="Metsatükk Pärnumaal"
              alghind={25000}
              county="Pärnumaa"
              area={12.5}
              endsAt={futureDate(120)}
              status="active"
              image={{ src: 'https://placehold.co/400x250/2E6B4F/FFFFFF?text=Mets', alt: 'Mets' }}
            />
          </div>
          <div className="w-72">
            <LotCard
              title="Metsatükk Harjumaal"
              alghind={18000}
              county="Harjumaa"
              area={8.3}
              endsAt={futureDate(120)}
              status="ended"
              archive
              endYear={2025}
              finalPrice={22000}
              image={{ src: 'https://placehold.co/400x250/6B7570/FFFFFF?text=Mets', alt: 'Mets' }}
            />
          </div>
        </div>
      </Section>

      {/* ── AuctionTicker ── */}
      <Section title="AuctionTicker">
        <div className="flex flex-col gap-4">
          <AuctionTicker
            lots={[
              { title: 'Metsatükk 1', alghind: 15000, county: 'Tartumaa', area: 10, endsAt: futureDate(60), status: 'active', image: { src: 'https://placehold.co/400x250/2E6B4F/FFFFFF?text=Mets', alt: '' } },
              { title: 'Metsatükk 2', alghind: 22000, county: 'Viljandimaa', area: 15, endsAt: futureDate(30), status: 'endingSoon', image: { src: 'https://placehold.co/400x250/58B368/FFFFFF?text=Mets', alt: '' } },
            ]}
          />
          <AuctionTicker lots={[]} isLoading />
          <AuctionTicker lots={[]} />
        </div>
      </Section>

      {/* ── SpecialistCard ── */}
      <Section title="SpecialistCard">
        <div className="flex flex-wrap gap-md">
          <div className="w-64">
            <SpecialistCard name="Mari Mets" role="Metsaspetsialist" phone="+372 555 1234" email="mari@erametsad.ee" />
          </div>
          <div className="w-64">
            <SpecialistCard name="Jaan Jänes" role="Konsultant" mini />
          </div>
        </div>
      </Section>

      {/* ── ContactBand ── */}
      <Section title="ContactBand">
        <ContactBand
          title="Meie spetsialistid"
          description="Võta ühendust"
          contacts={[
            { name: 'Mari Mets', role: 'Metsaspetsialist', phone: '+372 555 1234' },
            { name: 'Jaan Jänes', role: 'Konsultant', email: 'jaan@erametsad.ee' },
          ]}
        />
      </Section>

      {/* ── Testimonial ── */}
      <Section title="Testimonial">
        <Testimonial
          quote="Suurepärane teenus ja väga abivalmis spetsialistid."
          author="Anne Metsaomanik"
          role="Metsaomanik"
        />
      </Section>

      {/* ── ArticleCard ── */}
      <Section title="ArticleCard">
        <div className="w-80">
          <ArticleCard
            title="Kuidas müüa metsa?"
            excerpt="Põhjalik juhend metsa müügiks oksjonil."
            date="15. märts 2025"
            href="#"
            category="Juhend"
          />
        </div>
      </Section>

      {/* ── DocumentLink ── */}
      <Section title="DocumentLink">
        <div className="flex flex-col gap-3 max-w-md">
          <DocumentLink title="Oksjonitingimused.pdf" href="#" fileSize="245 KB" format="PDF" />
          <DocumentLink title="Hinnakiri.xlsx" href="#" fileSize="50 KB" format="XLSX" />
        </div>
      </Section>

      {/* ── FilterPanel ── */}
      <Section title="FilterPanel">
        <FilterPanel
          filters={[
            { id: 'county', label: 'Maakond', type: 'chip', options: [{ value: 'harju', label: 'Harjumaa' }, { value: 'tartu', label: 'Tartumaa' }] },
            { id: 'price', label: 'Hind', type: 'range', range: { min: 0, max: 100000, step: 1000 } },
          ]}
          values={{ county: '', price: [0, 100000] as [number, number] }}
          onChange={noop}
          onClear={noop}
          activeCount={0}
        />
      </Section>

      {/* ── StickyTOC ── */}
      <Section title="StickyTOC">
        <div className="flex gap-6">
          <div className="flex-1">
            <div id="sec1">
              <h3 className="font-heading text-h3 text-ink">Sissejuhatus</h3>
              <p className="text-body text-ink-muted">Sissejuhatav tekst..</p>
            </div>
            <div id="sec2" className="mt-xl">
              <h3 className="font-heading text-h3 text-ink">Põhiosa</h3>
              <p className="text-body text-ink-muted">Põhiosa tekst..</p>
            </div>
            <div id="sec3" className="mt-xl">
              <h3 className="font-heading text-h3 text-ink">Kokkuvõte</h3>
              <p className="text-body text-ink-muted">Kokkuvõttev tekst..</p>
            </div>
          </div>
          <div className="w-64">
            <StickyTOC
              sections={[
                { id: 'sec1', title: 'Sissejuhatus' },
                { id: 'sec2', title: 'Põhiosa' },
                { id: 'sec3', title: 'Kokkuvõte' },
              ]}
            />
          </div>
        </div>
      </Section>

      {/* ── SearchableAccordion ── */}
      <Section title="SearchableAccordion">
        <SearchableAccordion
          items={[
            { q: 'Kuidas registreerida?', a: 'Registreeri kasutajaks veebilehel.', slug: 'reg' },
            { q: 'Kuidas pakkuda?', a: 'Tee pakkumine oksjoni lehel.', slug: 'bid' },
          ]}
        />
      </Section>

      {/* ── LeadForm ── */}
      <Section title="LeadForm">
        <LeadForm slug="styleguide" />
      </Section>

      {/* ── MapEstonia (dynamic) ── */}
      <Section title="MapEstonia">
        <Suspense fallback={<div className="h-64 rounded-card bg-bg-mist flex items-center justify-center text-ink-muted">Laadin kaarti...</div>}>
          <div className="h-64">
            <MapEstonia pins={[{ lat: 58.6, lng: 25.0, label: 'Eesti' }]} />
          </div>
        </Suspense>
      </Section>
    </div>
  )
}