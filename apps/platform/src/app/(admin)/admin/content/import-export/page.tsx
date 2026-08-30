import { ImportForm } from './_components/ImportForm'
import { MAX_IMPORT_BYTES, MAX_IMPORT_ITEMS } from './_lib/import-export'
import { secondaryButtonClass } from '../../../_components/FormField'
import { PageHeader } from '../../../_components/PageHeader'
import { requireAdminRepositories } from '../../../_lib/admin'

export const metadata = { title: 'Import ja eksport' }

export default async function AdminContentImportExportPage() {
  const { repositories } = await requireAdminRepositories()

  const [articles, pages] = await Promise.all([
    repositories.find({ collection: 'articles', pagination: false }),
    repositories.find({ collection: 'pages', pagination: false }),
  ])
  const maxMiB = Math.round(MAX_IMPORT_BYTES / (1024 * 1024))

  return (
    <div>
      <PageHeader
        title="Import ja eksport"
        description="Laadi artiklid ja lehed JSON-failina alla või üles. Import uuendab olemasolevaid kirjeid URL-nime alusel."
      />
      <div className="mt-md grid grid-cols-1 items-start gap-sm lg:grid-cols-2">
        <section className="rounded-card border border-border bg-bgPage p-md">
          <h2 className="mb-xs font-heading text-h4 font-bold text-ink">Eksport</h2>
          <p className="text-bodySm text-ink-muted">
            Artikleid: <span className="font-semibold text-ink">{String(articles.docs.length)}</span>
            , lehti: <span className="font-semibold text-ink">{String(pages.docs.length)}</span>.
            Fail sisaldab kõiki redigeeritavaid välju.
          </p>
          <div className="mt-sm flex flex-col items-start gap-xs">
            <a className={secondaryButtonClass} href="/api/v1/admin/export/content?type=articles">
              Laadi alla artiklid
            </a>
            <a className={secondaryButtonClass} href="/api/v1/admin/export/content?type=pages">
              Laadi alla lehed
            </a>
            <a className={secondaryButtonClass} href="/api/v1/admin/export/content?type=all">
              Laadi alla kõik
            </a>
            <a className={secondaryButtonClass} href="/api/v1/admin/export/content/sample">
              Laadi alla näidis
            </a>
          </div>
        </section>
        <section className="rounded-card border border-border bg-bgPage p-md">
          <h2 className="mb-xs font-heading text-h4 font-bold text-ink">Import</h2>
          <p className="text-bodySm text-ink-muted">
            Lubatud on kuni {String(maxMiB)} MiB ja {String(MAX_IMPORT_ITEMS)} kirjet faili kohta.
            Olemasoleva URL-nimega kirje uueneb, uus luuakse.
          </p>
          <ImportForm />
        </section>
      </div>
    </div>
  )
}
