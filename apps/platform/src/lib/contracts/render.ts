import type { ContractTemplateSourceFormat } from '@/lib/data/schema'

export interface ContractTemplate {
  id?: string | undefined
  name: string
  type: 'framework' | 'auction'
  version: string
  placeholders?: { key: string }[] | undefined
  docxFile?: string | undefined
  active: boolean
  htmlContent?: string | undefined
  /** Drafted source from the editor; both fields are NULL for DOCX-only versions. */
  sourceContent?: string | null | undefined
  sourceFormat?: ContractTemplateSourceFormat | null | undefined
}

export interface RenderedContract {
  html: string
}

export function renderTemplate(
  template: ContractTemplate,
  data: Record<string, string>,
): RenderedContract {
  const htmlContent =
    storedSourceHtml(template) ?? template.htmlContent ?? generateFallbackHtml(template, data)

  let html = htmlContent
  for (const [key, value] of Object.entries(data)) {
    html = html.replaceAll(`{{${key}}}`, value)
  }

  return { html }
}

function generateFallbackHtml(
  template: ContractTemplate,
  data: Record<string, string>,
): string {
  const lines: string[] = [
    '<!DOCTYPE html>',
    '<html><head><meta charset="utf-8"><style>',
    'body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; }',
    'h1 { color: #1a3a5c; }',
    '.header { border-bottom: 2px solid #1a3a5c; padding-bottom: 10px; margin-bottom: 30px; }',
    '.field { margin: 8px 0; }',
    '.label { font-weight: bold; display: inline-block; width: 200px; }',
    '</style></head><body>',
    '<div class="header">',
    `<h1>${template.name}</h1>`,
    `<p>Version: ${template.version}</p>`,
    '</div>',
  ]

  for (const [key, value] of Object.entries(data)) {
    lines.push(
      `<div class="field"><span class="label">${key}:</span> ${value}</div>`,
    )
  }

  lines.push('</body></html>')
  return lines.join('\n')
}

/**
 * Stored editor source wins over DOCX-derived htmlContent; missing/empty
 * source or an unknown format returns null so DOCX-only versions keep the
 * existing paths untouched.
 */
function storedSourceHtml(template: ContractTemplate): string | null {
  const source = template.sourceContent
  if (typeof source !== 'string' || source.trim().length === 0) return null
  if (template.sourceFormat === 'html') return source
  if (template.sourceFormat === 'txt') return wrapTxtSource(template, source)
  return null
}

function wrapTxtSource(template: ContractTemplate, source: string): string {
  const lines: string[] = [
    '<!DOCTYPE html>',
    '<html><head><meta charset="utf-8"><style>',
    'body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; }',
    'h1 { color: #1a3a5c; }',
    'pre { font-family: Arial, sans-serif; white-space: pre-wrap; }',
    '</style></head><body>',
    `<h1>${template.name}</h1>`,
    `<p>Version: ${template.version}</p>`,
    `<pre>${escapeHtml(source)}</pre>`,
    '</body></html>',
  ]
  return lines.join('\n')
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}