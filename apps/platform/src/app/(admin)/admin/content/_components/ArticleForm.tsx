import Link from 'next/link'

import { CheckboxField } from './CheckboxField'
import {
  contentPublicPath,
  redirectPathsForSlugChange,
  utcIsoToTallinnInputValue,
} from './scheduled-publish'
import { saveArticleAction } from '../../../_actions/content'
import {
  FormField,
  FormSelectField,
  FormTextareaField,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../../_components/FormField'
import { requireAdminRepositories } from '../../../_lib/admin'
import { contentStatusLabels } from '../../../_lib/labels'
import {
  articleCategoryLabels,
  ogPreview,
  SEO_DESCRIPTION_MAX,
  SEO_TITLE_MAX,
  seoCounter,
  serpPreview,
} from '../articles/_lib/article-seo'

import type { ArticleDoc } from '@/lib/data/repositories'
import { articleCategories, contentStatuses } from '@/lib/data/schema'

const statusOptions = contentStatuses.map((status) => ({
  value: status,
  label: contentStatusLabels[status],
}))

const categoryOptions = articleCategories.map((category) => ({
  value: category,
  label: articleCategoryLabels[category],
}))

const mediaIdHint = 'Meediafaili ID. Meediakogu haldus lisandub hiljem.'

function CharacterCounter({ value, max }: { value: string | null | undefined; max: number }) {
  const counter = seoCounter(value, max)
  return (
    <p
      className={`text-bodySm ${counter.over ? 'font-semibold text-danger' : 'text-inkMuted'}`}
    >
      {counter.length}/{counter.max} tähemärki{counter.over ? ' (üle lubatud)' : ''}
    </p>
  )
}

export async function ArticleForm({ article }: { article?: ArticleDoc }) {
  const { repositories } = await requireAdminRepositories()
  const { docs: specialists } = await repositories.find({
    collection: 'specialists',
    where: { active: { equals: true } },
    sort: 'name',
    pagination: false,
  })
  const specialistOptions = [
    { value: '', label: '— pole määratud —' },
    ...specialists.map((specialist) => ({ value: specialist.id, label: specialist.name })),
  ]

  const seoTitle = article?.seoTitle ?? ''
  const seoDescription = article?.seoDescription ?? ''
  const serp = serpPreview({
    slug: article?.slug,
    title: article?.title,
    seoTitle,
    excerpt: article?.excerpt,
    seoDescription,
  })
  const og = ogPreview({
    title: article?.title,
    seoTitle,
    excerpt: article?.excerpt,
    seoDescription,
    ogImageId: article?.ogImageId,
  })

  const redirectPaths =
    article?.status === 'published'
      ? redirectPathsForSlugChange('articles', article.slug, article.slug)
      : null

  return (
    <form
      action={saveArticleAction}
      className="max-w-container-sm space-y-sm rounded-card border border-border bg-bgPage p-md"
    >
      {article ? <input type="hidden" name="id" value={article.id} /> : null}
      <FormField label="Pealkiri" name="title" required defaultValue={article?.title ?? ''} />
      <FormField
        label="URL-nimi"
        name="slug"
        required
        hint="Näiteks: metsa-muugi-juhend"
        defaultValue={article?.slug ?? ''}
      />
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <FormSelectField
          label="Kategooria"
          name="category"
          options={categoryOptions}
          defaultValue={article?.category ?? 'uudised'}
        />
        <FormSelectField
          label="Autor-spetsialist"
          name="authorSpecialistId"
          options={specialistOptions}
          hint="Klientide loo autoriks vali meeskonna spetsialist."
          defaultValue={article?.authorSpecialistId ?? ''}
        />
      </div>
      <FormTextareaField
        label="Lühikirjeldus"
        name="excerpt"
        rows={2}
        defaultValue={article?.excerpt ?? ''}
      />
      <FormTextareaField
        label="Sisu"
        name="content"
        rows={10}
        hint="HTML sisu."
        defaultValue={article?.content ?? ''}
      />
      <FormField
        label="Autor (vaba tekst)"
        name="author"
        hint="Vana välja vanadele artiklitele; uute artiklite autoriks vali spetsialist."
        defaultValue={article?.author ?? ''}
      />
      <FormField
        label="Sildid"
        name="tags"
        hint="Eralda komadega, näiteks: müük, oksjon"
        defaultValue={
          Array.isArray(article?.tags) ? article.tags.map(String).join(', ') : ''
        }
      />
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <FormSelectField
          label="Olek"
          name="status"
          options={statusOptions}
          hint="Tulevikus seatud avaldamise ajaga jääb artikkel mustandiks kuni avaldamiseni."
          defaultValue={article?.status ?? 'draft'}
        />
        <FormField
          label="Avaldamise aeg"
          name="publishAt"
          type="datetime-local"
          step="60"
          hint="Kellaaeg Europe/Tallinn. Planeeritud avaldamine tehakse automaatselt."
          defaultValue={utcIsoToTallinnInputValue(article?.publishedAt)}
        />
      </div>
      <FormField
        label="Peapildi ID"
        name="featuredImageId"
        hint={mediaIdHint}
        defaultValue={article?.featuredImageId ?? ''}
      />
      <section className="space-y-sm rounded-card border border-border p-md">
        <h2 className="text-label font-semibold text-ink">SEO</h2>
        <div className="space-y-1">
          <FormField
            label="SEO pealkiri"
            name="seoTitle"
            hint="Otsingutulekus kuvatav pealkiri."
            defaultValue={seoTitle}
          />
          <CharacterCounter value={seoTitle} max={SEO_TITLE_MAX} />
        </div>
        <div className="space-y-1">
          <FormTextareaField
            label="SEO kirjeldus"
            name="seoDescription"
            rows={3}
            hint="Otsingutulekus kuvatav kirjeldus."
            defaultValue={seoDescription}
          />
          <CharacterCounter value={seoDescription} max={SEO_DESCRIPTION_MAX} />
        </div>
        <FormField
          label="Kanooniline URL"
          name="canonicalUrl"
          hint="Kui artikkel kordab teise aadressi sisu, siis selle aadress."
          defaultValue={article?.canonicalUrl ?? ''}
        />
        <FormField
          label="OG-pildi ID"
          name="ogImageId"
          hint={`Jagamisel kuvatav pilt (soovituslik 1200×630). ${mediaIdHint}`}
          defaultValue={article?.ogImageId ?? ''}
        />
        <CheckboxField
          label="Indekseerimine lubatud"
          name="robotsIndex"
          hint="Kui märkimata, palutakse otsingumootoritel artikkel indekseerimata jätta (noindex)."
          defaultChecked={article?.robotsIndex ?? true}
        />
        <div className="space-y-1 rounded-card bg-bgMist p-sm">
          <p className="text-bodySm text-inkMuted">Otsingutuleku eelvaade</p>
          <p className="text-bodySm text-primaryDark">{serp.url}</p>
          <p className="text-body font-medium text-primary">{serp.title}</p>
          <p className="text-bodySm text-ink">{serp.description}</p>
        </div>
        <div>
          <p className="mb-1 text-bodySm text-inkMuted">Jagamise (OG) eelvaade</p>
          <div className="overflow-hidden rounded-card border border-border">
            <div className="flex h-36 items-center justify-center bg-bgMist px-sm text-bodySm text-inkMuted">
              {og.imageId ? `OG pilt: ${og.imageId}` : 'OG pilt puudub'}
            </div>
            <div className="space-y-1 bg-bgPage p-sm">
              <p className="text-bodySm uppercase text-inkMuted">{og.siteName}</p>
              <p className="text-body font-medium text-ink">{og.title}</p>
              <p className="text-bodySm text-inkMuted">{og.description}</p>
            </div>
          </div>
        </div>
      </section>
      {article?.status === 'published' && redirectPaths ? (
        <CheckboxField
          label="Loo suunamine vana aadressilt"
          name="createRedirect"
          hint={`URL-i muutusel luuakse suunamine aadressilt ${redirectPaths.from} aadressile uue URL-i.`}
          defaultChecked
        />
      ) : null}
      <div className="flex items-center gap-sm pt-xs">
        <button type="submit" className={primaryButtonClass}>
          Salvesta
        </button>
        <Link href="/admin/content/articles" className={secondaryButtonClass}>
          Tühista
        </Link>
        {article?.status === 'published' ? (
          <Link
            href={contentPublicPath('articles', article.slug)}
            target="_blank"
            className={secondaryButtonClass}
          >
            Vaata avaldatud versiooni
          </Link>
        ) : null}
      </div>
    </form>
  )
}
