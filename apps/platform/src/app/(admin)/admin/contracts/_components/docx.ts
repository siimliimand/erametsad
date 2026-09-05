import { inflateRawSync } from 'node:zlib'

/**
 * Minimal ZIP reader for .docx placeholder validation. A .docx is a ZIP of
 * XML parts; only `word/document.xml` is needed, so the central directory is
 * parsed by hand and entries are inflated with node:zlib — no new
 * dependency.
 */

export class DocxParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DocxParseError'
  }
}

const LOCAL_HEADER_SIGNATURE = 0x04034b50
const CENTRAL_HEADER_SIGNATURE = 0x02014b50
const EOCD_SIGNATURE = 0x06054b50
const EOCD_SIZE = 22
const EOCD_MAX_COMMENT_LENGTH = 0xffff
const METHOD_STORED = 0
const METHOD_DEFLATE = 8
const DOCUMENT_XML_PATH = 'word/document.xml'

const decoder = new TextDecoder('utf-8')

export function isZipArchive(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b
}

interface ZipEntry {
  method: number
  compressedSize: number
  localHeaderOffset: number
}

function findEndOfCentralDirectory(view: DataView): number {
  const minOffset = Math.max(0, view.byteLength - EOCD_SIZE - EOCD_MAX_COMMENT_LENGTH)
  for (let offset = view.byteLength - EOCD_SIZE; offset >= minOffset; offset -= 1) {
    if (view.getUint32(offset, true) === EOCD_SIGNATURE) {
      return offset
    }
  }
  throw new DocxParseError('Fail ei ole korrektne ZIP-arhiiv (lahkusat lõppu ei leitud).')
}

function readCentralDirectory(bytes: Uint8Array, view: DataView): Map<string, ZipEntry> {
  const eocdOffset = findEndOfCentralDirectory(view)
  const entryCount = view.getUint16(eocdOffset + 10, true)
  let offset = view.getUint32(eocdOffset + 16, true)
  const entries = new Map<string, ZipEntry>()
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > view.byteLength || view.getUint32(offset, true) !== CENTRAL_HEADER_SIGNATURE) {
      throw new DocxParseError('Fail ei ole korrektne ZIP-arhiiv (keskkataloog on rikutud).')
    }
    const method = view.getUint16(offset + 10, true)
    const compressedSize = view.getUint32(offset + 20, true)
    const nameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const localHeaderOffset = view.getUint32(offset + 42, true)
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength))
    entries.set(name, { method, compressedSize, localHeaderOffset })
    offset += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

function readEntryBytes(bytes: Uint8Array, view: DataView, entry: ZipEntry): Uint8Array {
  if (entry.localHeaderOffset + 30 > view.byteLength) {
    throw new DocxParseError('Fail ei ole korrektne ZIP-arhiiv (kirje päis on rikutud).')
  }
  if (view.getUint32(entry.localHeaderOffset, true) !== LOCAL_HEADER_SIGNATURE) {
    throw new DocxParseError('Fail ei ole korrektne ZIP-arhiiv (kirje päis on rikutud).')
  }
  const nameLength = view.getUint16(entry.localHeaderOffset + 26, true)
  const extraLength = view.getUint16(entry.localHeaderOffset + 28, true)
  const dataStart = entry.localHeaderOffset + 30 + nameLength + extraLength
  const dataEnd = dataStart + entry.compressedSize
  if (dataEnd > view.byteLength) {
    throw new DocxParseError('Fail ei ole korrektne ZIP-arhiiv (kirje andmed on lõigatud).')
  }
  const compressed = bytes.subarray(dataStart, dataEnd)
  if (entry.method === METHOD_STORED) {
    return compressed
  }
  if (entry.method === METHOD_DEFLATE) {
    try {
      return inflateRawSync(compressed)
    } catch {
      throw new DocxParseError('ZIP-kirje lahtipakkimine ebaõnnestus.')
    }
  }
  throw new DocxParseError(`Toetamata ZIP-pakkimise meetod: ${String(entry.method)}.`)
}

/** Raw XML of `word/document.xml` inside an uploaded .docx. */
export function extractDocxDocumentXml(bytes: Uint8Array): string {
  if (!isZipArchive(bytes)) {
    throw new DocxParseError('Fail ei ole ZIP-arhiiv (DOCX oodati).')
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const entries = readCentralDirectory(bytes, view)
  const entry = entries.get(DOCUMENT_XML_PATH)
  if (!entry) {
    throw new DocxParseError('DOCX-failist puudub word/document.xml.')
  }
  return decoder.decode(readEntryBytes(bytes, view, entry))
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, dec: string) => String.fromCodePoint(Number(dec)))
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&')
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/**
 * WordprocessingML → plain HTML preview source. Paragraph text is joined per
 * `<w:p>`, which also heals `{{tokens}}` that Word splits across several
 * `<w:t>` runs.
 */
export function docxXmlToHtml(xml: string): string {
  const lines: string[] = []
  for (const paragraph of xml.split('</w:p>')) {
    const runs = [...paragraph.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(
      (match) => match[1] ?? '',
    )
    const text = decodeXmlEntities(runs.join('')).trim()
    if (text !== '') {
      lines.push(`<p>${escapeHtml(text)}</p>`)
    }
  }
  const style =
    'body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; } p { margin: 0 0 8px; }'
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${style}</style></head><body>${lines.join('\n')}</body></html>`
}
