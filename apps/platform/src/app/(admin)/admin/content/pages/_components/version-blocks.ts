import { pageBlockTypes, type PageBlockType } from '@/lib/data/schema'

/**
 * Pure helpers behind the versions drawer: publish snapshots from
 * `page_versions` compared against the page's current `page_blocks` rows.
 * Kept free of React so the server page can parse snapshots when preparing
 * drawer props (client module exports cannot cross the RSC boundary).
 */

/** One block in a diff column: the validated snapshot entry shape. */
export interface DrawerBlock {
  readonly type: PageBlockType
  readonly config: unknown
}

/** Props-ready view of one `page_versions` row. */
export interface PageVersionOption {
  readonly id: string
  readonly version: number
  readonly label: string | null
  readonly createdAt: string
  readonly blocks: readonly DrawerBlock[]
}

export type VersionDiffStatus = 'same' | 'changed' | 'added' | 'removed'

export interface VersionDiffRow {
  /** 1-based block position the row compares. */
  readonly ordinal: number
  readonly status: VersionDiffStatus
  /** Left column: the block as stored in the selected version. */
  readonly versionBlock: DrawerBlock | null
  /** Right column: the block as currently saved on the page. */
  readonly currentBlock: DrawerBlock | null
}

/**
 * Positional per-block comparison (no diff library): blocks are aligned by
 * ordinal, equal configs count as `same`, a type or config difference as
 * `changed`; missing sides produce `removed` (present in the version, gone
 * now) and `added` (present now, not in the version).
 */
export function buildBlockDiff(
  versionBlocks: readonly DrawerBlock[],
  currentBlocks: readonly DrawerBlock[],
): VersionDiffRow[] {
  const length = Math.max(versionBlocks.length, currentBlocks.length)
  const rows: VersionDiffRow[] = []
  for (let index = 0; index < length; index += 1) {
    const versionBlock = versionBlocks[index] ?? null
    const currentBlock = currentBlocks[index] ?? null
    let status: VersionDiffStatus
    if (versionBlock && currentBlock) {
      status =
        versionBlock.type === currentBlock.type &&
        configJsonText(versionBlock.config) === configJsonText(currentBlock.config)
          ? 'same'
          : 'changed'
    } else if (versionBlock) {
      status = 'removed'
    } else {
      status = 'added'
    }
    rows.push({ ordinal: index + 1, status, versionBlock, currentBlock })
  }
  return rows
}

/**
 * Defensive `snapshot_json` decoder for the parent server component: entries
 * with an unknown type or malformed JSON are skipped instead of breaking the
 * drawer (restore re-validates everything through the registry schemas).
 */
export function parseVersionBlocks(snapshotJson: unknown): DrawerBlock[] {
  if (typeof snapshotJson !== 'string' || snapshotJson.trim() === '') return []
  let raw: unknown
  try {
    raw = JSON.parse(snapshotJson)
  } catch {
    return []
  }
  if (!Array.isArray(raw)) return []
  const blocks: DrawerBlock[] = []
  for (const entry of raw) {
    const type = (entry as Record<string, unknown> | null)?.type
    if (typeof type !== 'string' || !pageBlockTypes.includes(type as PageBlockType)) continue
    blocks.push({
      type: type as PageBlockType,
      config: (entry as Record<string, unknown>).config ?? {},
    })
  }
  return blocks
}

export function configJsonText(config: unknown): string {
  if (config === null || config === undefined) return '{}'
  // Snapshot configs come from JSON.parse, so re-stringifying cannot throw.
  return JSON.stringify(config, null, 2)
}
