import { SpecialistCard } from '@eametsad/ui'

import { CompanyCard } from '../../_components/CompanyCard'
import { buildMetadata } from '../../_lib/seo'

import { getRepositories } from '@/lib/data/runtime'

// D7 asks for ISR (revalidate = 3600) on content pages, but CI and deploy
// builds run `next build` without a seeded D1, so prerendering against the
// CMS would fail the build or bake empty pages. Request-time rendering is
// the repo-wide convention for DB-backed pages; drop `force-dynamic` and
// add generateStaticParams once build-time D1 seeding exists.
export const dynamic = 'force-dynamic'

export const metadata = buildMetadata({
  title: 'Metsaspetsialistid',
  description:
    'Meie metsaspetsialistid igas maakonnas. Helista või kirjuta otse – esimene nõuanne on tasuta.',
  path: '/meist/metsaspetsialistid',
})

export default async function MetsaspetsialistidPage() {
  const repos = await getRepositories()
  const [specialistsResult, settingsResult] = await Promise.all([
    repos.find({ collection: 'specialists', sort: 'name', limit: 6 }),
    repos.find({ collection: 'settings', limit: 1 }),
  ])
  const specialists = specialistsResult.docs
  const settings = settingsResult.docs[0]

  // Task 5.2 renders the whole seeded roster (6 cards). Hiding active:false
  // rows and the profile 301 semantics arrive with the profile task 5.3.
  const photoIds = [
    ...new Set(
      specialists
        .map((specialist) => specialist.photoId)
        .filter((photoId): photoId is string => photoId !== null),
    ),
  ]
  const imageUrlByPhotoId = new Map<string, string>()
  if (photoIds.length > 0) {
    const mediaResult = await repos.find({
      collection: 'media',
      where: { id: { in: photoIds }, url: { exists: true } },
      pagination: false,
    })
    for (const mediaAsset of mediaResult.docs) {
      if (mediaAsset.url) {
        imageUrlByPhotoId.set(mediaAsset.id, mediaAsset.url)
      }
    }
  }

  return (
    <main className="mx-auto w-full max-w-container-xl px-md py-xl lg:px-lg">
      <h1 className="font-heading text-h1 text-ink">Meie metsaspetsialistid</h1>
      <p className="mt-sm max-w-container-sm font-body text-body text-inkMuted">
        Igas maakonnas oma inimene — helista või kirjuta otse.
      </p>

      <ul className="mt-xl grid gap-lg sm:grid-cols-2 lg:grid-cols-3">
        {specialists.map((specialist) => {
          const image = specialist.photoId
            ? imageUrlByPhotoId.get(specialist.photoId)
            : undefined
          return (
            <li key={specialist.id}>
              {/* SpecialistCardProps uses bare optional fields; spread keeps
                  absent values out of the props under exactOptionalPropertyTypes. */}
              <SpecialistCard
                name={specialist.name}
                role={specialist.role ?? ''}
                {...(specialist.phone ? { phone: specialist.phone } : {})}
                {...(specialist.email ? { email: specialist.email } : {})}
                {...(image ? { image } : {})}
              />
            </li>
          )
        })}
      </ul>

      <section className="mt-xl max-w-container-sm">
        <CompanyCard
          orgName={settings?.orgName ?? undefined}
          orgRegCode={settings?.orgRegCode ?? undefined}
          orgAddress={settings?.orgAddress ?? undefined}
        />
      </section>
    </main>
  )
}
