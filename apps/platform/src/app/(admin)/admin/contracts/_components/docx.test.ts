import { deflateRawSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'

import {
  DocxParseError,
  docxXmlToHtml,
  extractDocxDocumentXml,
  isZipArchive,
} from './docx'
import { extractTemplateTokens } from './placeholder-catalogue'

interface ZipInput {
  name: string
  data: Uint8Array
  store: boolean
}

function u8(bytes: number[]): Uint8Array {
  return new Uint8Array(bytes)
}

function u16(value: number): Uint8Array {
  return u8([value & 0xff, (value >> 8) & 0xff])
}

function u32(value: number): Uint8Array {
  return u8([value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >>> 24) & 0xff])
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function buildZip(entries: readonly ZipInput[]): Uint8Array {
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const entry of entries) {
    const name = new TextEncoder().encode(entry.name)
    const payload = entry.store ? entry.data : deflateRawSync(entry.data)
    const method = entry.store ? 0 : 8
    const localHeader = concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(method),
      u16(0),
      u16(0),
      u32(0),
      u32(payload.length),
      u32(entry.data.length),
      u16(name.length),
      u16(0),
    ])
    parts.push(localHeader, name, payload)
    const centralHeader = concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(method),
      u16(0),
      u16(0),
      u32(0),
      u32(payload.length),
      u32(entry.data.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
    ])
    central.push(centralHeader, name)
    offset += localHeader.length + name.length + payload.length
  }
  const centralBytes = concat(central)
  const eocd = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralBytes.length),
    u32(offset),
    u16(0),
  ])
  return concat([...parts, centralBytes, eocd])
}

const documentXml =
  '<?xml version="1.0"?><w:document><w:body>' +
  '<w:p><w:r><w:t>Müügleping</w:t></w:r></w:p>' +
  '<w:p><w:r><w:t>{{bidder.</w:t></w:r><w:r><w:t>name}}</w:t></w:r></w:p>' +
  '</w:body></w:document>'

describe('extractDocxDocumentXml', () => {
  it('reads a deflated word/document.xml entry', () => {
    const zip = buildZip([
      { name: '[Content_Types].xml', data: new TextEncoder().encode('<Types/>'), store: true },
      { name: 'word/document.xml', data: new TextEncoder().encode(documentXml), store: false },
    ])
    expect(extractDocxDocumentXml(zip)).toBe(documentXml)
  })

  it('reads a stored word/document.xml entry', () => {
    const zip = buildZip([
      { name: 'word/document.xml', data: new TextEncoder().encode(documentXml), store: true },
    ])
    expect(extractDocxDocumentXml(zip)).toBe(documentXml)
  })

  it('rejects a zip without word/document.xml', () => {
    const zip = buildZip([{ name: 'other.xml', data: new TextEncoder().encode('<x/>'), store: true }])
    expect(() => extractDocxDocumentXml(zip)).toThrow(DocxParseError)
  })

  it('rejects non-zip bytes', () => {
    const bytes = new TextEncoder().encode('plain text, definitely not a zip archive')
    expect(isZipArchive(bytes)).toBe(false)
    expect(() => extractDocxDocumentXml(bytes)).toThrow(DocxParseError)
  })

  it('rejects truncated zip bytes', () => {
    const zip = buildZip([
      { name: 'word/document.xml', data: new TextEncoder().encode(documentXml), store: true },
    ])
    expect(() => extractDocxDocumentXml(zip.subarray(0, 12))).toThrow(DocxParseError)
  })
})

describe('docxXmlToHtml', () => {
  it('joins paragraph runs and heals tokens split across runs', () => {
    const html = docxXmlToHtml(documentXml)
    expect(html).toContain('<p>Müügleping</p>')
    expect(extractTemplateTokens(html)).toEqual(['bidder.name'])
  })

  it('decodes xml entities and escapes html output', () => {
    const xml = '<w:p><w:r><w:t>Hind &lt;1 000&amp;</w:t></w:r></w:p>'
    const html = docxXmlToHtml(xml)
    expect(html).toContain('<p>Hind &lt;1 000&amp;</p>')
  })

  it('skips empty paragraphs', () => {
    const xml = '<w:p></w:p><w:p><w:r><w:t>tekst</w:t></w:r></w:p>'
    expect(docxXmlToHtml(xml).match(/<p>/g)).toHaveLength(1)
  })
})
