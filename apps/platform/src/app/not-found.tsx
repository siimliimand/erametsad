import { NotFound404Island } from './_components/NotFound404Island'

// Global 404 per 00-global-shell.md §5: forest visual, H1, CMS article
// search, home CTA. It renders inside the root layout — the (marketing)
// shell does not wrap it — so the card carries the brand on its own.
// No forest photo asset exists yet (media lands in R2 later); a
// forest-toned gradient stands in as the placeholder.

const SEARCH_ACTION = '/artiklid'

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primaryHover via-primary to-primaryDark px-md py-xl">
      <NotFound404Island />
      <div className="w-full max-w-container-sm rounded-card bg-white p-md text-center shadow-card md:p-lg">
        <h1 className="font-heading text-h1 font-bold text-primaryDark">
          Lehekülge ei leitud
        </h1>
        <p className="mt-xs text-body text-ink">
          Kahjuks seda lehekülge ei ole. Proovi otsida või naase avalehele.
        </p>
        <form
          action={SEARCH_ACTION}
          method="get"
          className="mx-auto mt-md flex w-full max-w-md gap-xs"
        >
          <label htmlFor="q" className="sr-only">
            Otsi artiklitest
          </label>
          <input
            id="q"
            name="q"
            type="search"
            placeholder="Otsi artiklitest"
            className="h-12 min-w-0 flex-1 rounded-input border border-border bg-white px-4 text-body text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            className="h-12 shrink-0 rounded-button bg-primary px-6 font-label font-semibold text-ink-inverse transition-colors duration-hover ease-hover hover:bg-primary-hover"
          >
            Otsi
          </button>
        </form>
        <a
          href="/"
          className="mt-md inline-flex h-12 items-center justify-center rounded-button bg-cta px-6 font-label font-semibold text-ink transition-colors duration-hover ease-hover hover:bg-cta-hover"
        >
          Avalehele
        </a>
      </div>
    </main>
  )
}
