/* eslint-disable no-console */
import { statSync } from 'node:fs'
import { resolve } from 'node:path'

import type { CoreRepositories } from '../repositories'
import type { MediaAsset } from '../schema'

interface SeedLotPhoto {
  filename: string
  alt: string
}

// Same-origin demo assets (D4): plain files under public/, no R2 and no CSP
// change. The URL is reused verbatim as the media entry url on seed auctions.
const SEED_LOT_PHOTOS: SeedLotPhoto[] = [
  { filename: 'mets-paikesekiired.webp', alt: 'Päikesekiired metsas' },
  { filename: 'mets-roheline.webp', alt: 'Roheline segamets' },
  { filename: 'jarv-metsas.webp', alt: 'Järv metsa vahel' },
  { filename: 'mets-lainvaade.webp', alt: 'Mets ülevaltvaates' },
  { filename: 'manni-mets.webp', alt: 'Männimets' },
  { filename: 'kuusik.webp', alt: 'Kuusik' },
  { filename: 'vanad-puud.webp', alt: 'Vanad puud metsas' },
  { filename: 'metsatee-lainvaade.webp', alt: 'Metsatee ülevaltvaates' },
]

export function seedLotPhotoUrl(filename: string): string {
  return `/seed/lot-photos/${filename}`
}

export async function seedMedia(repos: CoreRepositories): Promise<MediaAsset[]> {
  const existing = await repos.find({ collection: 'media', limit: SEED_LOT_PHOTOS.length })
  if (existing.docs.length > 0) {
    console.log('Media already seeded, skipping')
    return existing.docs
  }

  const photoDir = resolve(process.cwd(), 'public', 'seed', 'lot-photos')
  const created: MediaAsset[] = []
  for (const photo of SEED_LOT_PHOTOS) {
    const filePath = resolve(photoDir, photo.filename)
    let filesize: number
    try {
      filesize = statSync(filePath).size
    } catch {
      throw new Error(
        `Seed lot photo missing: ${filePath}. Bundle apps/platform/public/seed/lot-photos before seeding.`,
      )
    }
    const doc = await repos.create({
      collection: 'media',
      data: {
        filename: photo.filename,
        mimeType: 'image/webp',
        filesize,
        url: seedLotPhotoUrl(photo.filename),
        alt: photo.alt,
        status: 'published',
      },
    })
    created.push(doc)
  }

  console.log(`Seeded ${String(created.length)} lot photos`)
  return created
}
