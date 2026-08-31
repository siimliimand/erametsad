// Sealed-bid (pimepakkumine) explainer for the kinnistu müük service page.
// Diagram copy per docs/design/marketing/03-teenused-kinnistu-muuk.md block 4;
// mechanics per docs/design/portal/03-lot-detail-sealed.md.
const SEALED_STEPS = [
  'Ostja esitab tähtajaks ühe pakkumise, mida keegi teine ei näe.',
  'Pärast tähtaega avatakse kõik pakkumised üheaegselt.',
  'Võidab kõrgeim kehtiv pakkumine.',
]

interface ComparisonRow {
  criterion: string
  open: string
  sealed: string
}

const OPEN_COLUMN_LABEL = 'Avatud oksjon (tõusev hind)'
const SEALED_COLUMN_LABEL = 'Pimepakkumine (suletud ümbrik)'

const COMPARISON_ROWS: ComparisonRow[] = [
  {
    criterion: 'Pakkumise esitamine',
    open: 'Avalikult, üksteise järel',
    sealed: 'Üheaegselt enne tähtaega, üks pakkumine ostja kohta',
  },
  {
    criterion: 'Teiste pakkumised',
    open: 'Summad on kohe kõigile nähtavad',
    sealed: 'Ükski summa ei ole enne avamist nähtav',
  },
  {
    criterion: 'Hinna kujunemine',
    open: 'Hind tõuseb fikseeritud sammudega',
    sealed: 'Iga ostja esitab kohe oma parima hinna',
  },
  {
    criterion: 'Võitja selgub',
    open: 'Oksjoni lõppedes',
    sealed: 'Pakkumiste üheaegsel avamisel',
  },
]

// Decorative flow diagram: sealed envelopes -> simultaneous opening ->
// highest bid wins. No text inside; the numbered list and the copy repeat
// the content for screen readers and the mobile vertical timeline.
function SealedDiagram() {
  return (
    <div className="hidden rounded-card border border-border bg-bgPage p-md shadow-card md:block">
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 640 190"
        fill="none"
        className="h-auto w-full"
      >
        <defs>
          <g id="sealed-explainer-envelope">
            <rect
              width="96"
              height="60"
              rx="6"
              className="fill-primaryLight stroke-primary"
              strokeWidth="2"
            />
            <path
              d="M4 6 L48 36 L92 6"
              className="stroke-primary"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
          <marker
            id="sealed-explainer-arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="8"
            refY="4"
            orient="auto"
          >
            <path d="M0 0 L8 4 L0 8 Z" className="fill-inkMuted" />
          </marker>
        </defs>

        <use href="#sealed-explainer-envelope" x="24" y="92" />
        <use href="#sealed-explainer-envelope" x="52" y="62" />
        <use href="#sealed-explainer-envelope" x="80" y="32" />

        <path
          d="M196 112 H250"
          className="stroke-inkMuted"
          strokeWidth="2"
          markerEnd="url(#sealed-explainer-arrowhead)"
        />

        <g transform="translate(276 66)">
          <rect
            x="36"
            y="6"
            width="28"
            height="48"
            rx="3"
            transform="rotate(8 50 30)"
            className="fill-bgPage stroke-primary"
            strokeWidth="2"
          />
          <rect
            y="36"
            width="96"
            height="60"
            rx="6"
            className="fill-primaryLight stroke-primary"
            strokeWidth="2"
          />
          <path
            d="M4 40 L48 8 L92 40"
            className="stroke-primary"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        <path
          d="M392 112 H446"
          className="stroke-inkMuted"
          strokeWidth="2"
          markerEnd="url(#sealed-explainer-arrowhead)"
        />

        <g transform="translate(466 40)">
          <rect x="0" y="70" width="30" height="60" rx="4" className="fill-primaryLight" />
          <rect x="42" y="46" width="30" height="84" rx="4" className="fill-primaryLight" />
          <rect x="84" y="10" width="30" height="120" rx="4" className="fill-primary" />
          <path
            d="M86 -4 L97 7 L117 -13"
            className="stroke-primary"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>
    </div>
  )
}

const tdClass =
  'block text-body text-inkMuted before:mb-2xs before:block before:font-label before:font-semibold before:text-inkMuted before:content-[attr(data-label)] md:table-cell md:p-sm md:before:hidden'

export function SealedExplainer() {
  return (
    <section aria-labelledby="pimepakkumine-pealkiri" className="mt-xl">
      <h2 id="pimepakkumine-pealkiri" className="font-heading text-h2 text-ink">
        Metsakinnistu oksjon toimub pimepakkumisena
      </h2>

      <div className="mt-md grid grid-cols-12 gap-gutter">
        <div className="col-span-12 lg:col-span-6">
          <SealedDiagram />
          {/* Vertical timeline form of the diagram: the accessible text
              repeat on desktop, the only form of the scheme on mobile. */}
          <ol className="relative mt-md space-y-sm border-l-2 border-border pl-md md:border-l-0 md:pl-0">
            {SEALED_STEPS.map((step, index) => (
              <li
                key={step}
                className="flex items-start gap-sm text-body text-inkMuted"
              >
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-primary text-bodySm font-bold text-primary"
                >
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        <div className="col-span-12 lg:col-span-6">
          <p className="max-w-container-sm text-body text-inkMuted">
            Pimepakkumine ehk suletud pakkumine tähendab, et keegi ei tea
            teiste pakkumisi enne avamist. Parim hind ei ole nähtav ja iga
            ostja on motiveeritud pakkuma maksimaalselt.
          </p>
          <p className="mt-sm max-w-container-sm text-body text-inkMuted">
            Kõik pakkumised esitatakse üheaegselt enne tähtaega. Enne avamist
            ei näe ühtegi summat ei müüja ega teised pakkujad. Tähtaja
            möödudes avatakse kõik pakkumised korraga ja võidab kõrgeim
            kehtiv pakkumine.
          </p>
        </div>
      </div>

      {/* Open vs sealed comparison: real table on md+, card-ified rows on
          mobile via data-labels (design doc 03 §Accessibility). */}
      <table className="mt-lg w-full border-collapse text-left md:table">
        <caption className="sr-only">
          Avatud oksjoni ja pimepakkumise võrdlus
        </caption>
        <thead className="hidden md:table-header-group">
          <tr>
            <th scope="col" className="p-sm pb-xs align-bottom">
              <span className="sr-only">Kriteerium</span>
            </th>
            <th
              scope="col"
              className="p-sm pb-xs align-bottom font-label font-semibold text-inkMuted"
            >
              {OPEN_COLUMN_LABEL}
            </th>
            <th
              scope="col"
              className="p-sm pb-xs align-bottom font-label font-semibold text-inkMuted"
            >
              {SEALED_COLUMN_LABEL}
            </th>
          </tr>
        </thead>
        <tbody className="block space-y-xs md:table-row-group md:space-y-0 md:divide-y md:divide-border">
          {COMPARISON_ROWS.map((row) => (
            <tr
              key={row.criterion}
              className="block rounded-card border border-border bg-bgPage p-sm md:table-row md:rounded-none md:border-0 md:bg-transparent md:p-0"
            >
              <th
                scope="row"
                className="block pb-xs pr-md text-body font-semibold text-ink md:table-cell md:p-sm"
              >
                {row.criterion}
              </th>
              <td data-label="Avatud oksjon" className={tdClass}>
                {row.open}
              </td>
              <td data-label="Pimepakkumine" className={tdClass}>
                {row.sealed}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
