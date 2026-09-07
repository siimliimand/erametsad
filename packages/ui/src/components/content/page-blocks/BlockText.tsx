import type { TextBlockConfig } from './types'

// Blank-line separated paragraphs (mirrors textConfigSchema's comment).
function paragraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== '')
}

export function BlockText({ config }: { config: TextBlockConfig }) {
  const blocks = paragraphs(config.body)
  if (blocks.length === 0) return null
  return (
    <section className="mx-auto max-w-container-xl px-md py-xl md:px-lg">
      <div className="max-w-container-sm">
        {config.heading !== undefined && (
          <h2 className="font-heading text-h2 text-ink">{config.heading}</h2>
        )}
        <div
          className={`space-y-sm text-body text-inkMuted ${
            config.heading !== undefined ? 'mt-md' : ''
          }`}
        >
          {blocks.map((paragraph) => (
            <p key={paragraph.slice(0, 40)}>{paragraph}</p>
          ))}
        </div>
      </div>
    </section>
  )
}
