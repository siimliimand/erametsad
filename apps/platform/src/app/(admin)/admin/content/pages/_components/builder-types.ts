import type { BlockConfig, BlockConfigOf } from '@/lib/content/blocks'
import type { PageBlockType } from '@/lib/data/schema'

/**
 * Builder-side block: the DB row narrowed to a tagged union so `type` and
 * `config` stay correlated (switching on `type` narrows `config`). The id is
 * the `page_blocks.id` (or a client-generated UUID for unsaved blocks).
 */
export type BuilderBlock = {
  [T in PageBlockType]: {
    readonly id: string
    readonly type: T
    readonly config: BlockConfigOf<T>
  }
}[PageBlockType]

export type BlockReorderDirection = 'up' | 'down'

/**
 * Controlled builder contract: the consumer page owns the blocks state and
 * persistence; the builder only raises change events with validated data.
 * `onUpdate` receives a config that already passed the registry zod schema.
 */
export interface PageBlocksBuilderProps {
  blocks: BuilderBlock[]
  onAdd: (type: PageBlockType) => void
  onUpdate: (id: string, config: BlockConfig) => void
  onReorder: (id: string, direction: BlockReorderDirection) => void
  onDelete: (id: string) => void
}
