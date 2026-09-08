import { blockRegistry, type BlockConfig, type BlockConfigOf } from './registry'

/**
 * Parse/serialize bridge for the `page_blocks.config_json` TEXT-JSON column.
 * Parsing always goes through the per-type zod schema, so renderer and builder
 * never see unvalidated data from D1.
 */

export class BlockConfigError extends Error {
  readonly blockType: string
  readonly issues: readonly { path: string; message: string }[]

  constructor(blockType: string, issues: readonly { path: string; message: string }[]) {
    super(`Invalid config for block type "${blockType}": ${issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ')}`)
    this.name = 'BlockConfigError'
    this.blockType = blockType
    this.issues = issues
  }
}

export type BlockConfigParseResult<T extends BlockConfig> =
  | { success: true; data: T }
  | { success: false; error: BlockConfigError }

export function safeParseBlockConfig<T extends keyof typeof blockRegistry>(
  type: T,
  raw: unknown,
): BlockConfigParseResult<BlockConfigOf<T>> {
  const result = blockRegistry[type].schema.safeParse(raw)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    error: new BlockConfigError(
      type,
      result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    ),
  }
}

export function parseBlockConfig<T extends keyof typeof blockRegistry>(
  type: T,
  raw: unknown,
): BlockConfigOf<T> {
  const result = safeParseBlockConfig(type, raw)
  if (!result.success) throw result.error
  return result.data
}

export function serializeBlockConfig(config: BlockConfig): string {
  return JSON.stringify(config)
}

/**
 * Decodes the TEXT column value into a typed config. Returns null for a null
 * or empty column value; throws BlockConfigError on malformed JSON or schema
 * violations.
 */
export function parseBlockConfigJson<T extends keyof typeof blockRegistry>(
  type: T,
  configJson: string | null,
): BlockConfigOf<T> | null {
  if (configJson === null || configJson.trim() === '') return null
  let raw: unknown
  try {
    raw = JSON.parse(configJson)
  } catch {
    throw new BlockConfigError(type, [
      { path: '', message: 'Config ei ole kehtiv JSON.' },
    ])
  }
  return parseBlockConfig(type, raw)
}
