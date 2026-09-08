// Minimal dependency-free ZIP writer for the GDPR export (task 8.5): store
// method only (no compression), UTF-8 entry names. Pure and synchronous so it
// runs on the Workers runtime and stays unit-testable (task 8.6).

export interface GdprZipEntry {
  name: string
  data: Uint8Array
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of data) {
    const index = (crc ^ byte) & 0xff
    // Table entries are never zero, so the fallback only satisfies indexing.
    crc = (CRC_TABLE[index] ?? 0) ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

/** DOS date/time pair for the central directory (second resolution, 2s steps). */
function dosDateTime(date: Date): { time: number; date: number } {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  }
}

/**
 * Builds a ZIP archive from in-memory entries. Entry names must be unique;
 * file times come from `now` so the output is deterministic per call.
 */
export function buildGdprZip(entries: GdprZipEntry[], now: Date = new Date()): Uint8Array {
  if (entries.length === 0) {
    throw new Error('ZIP export needs at least one entry')
  }
  const encoder = new TextEncoder()
  const { time, date } = dosDateTime(now)

  const chunks: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name)
    const crc = crc32(entry.data)
    const size = entry.data.length

    const local = new Uint8Array(30 + nameBytes.length)
    const localView = new DataView(local.buffer)
    localView.setUint32(0, 0x04034b50, true)
    localView.setUint16(4, 20, true) // version needed
    localView.setUint16(6, 0x0800, true) // UTF-8 names
    localView.setUint16(8, 0, true) // stored, no compression
    localView.setUint16(10, time, true)
    localView.setUint16(12, date, true)
    localView.setUint32(14, crc, true)
    localView.setUint32(18, size, true)
    localView.setUint32(22, size, true)
    localView.setUint16(26, nameBytes.length, true)
    local.set(nameBytes, 30)

    chunks.push(local, entry.data)

    const dir = new Uint8Array(46 + nameBytes.length)
    const dirView = new DataView(dir.buffer)
    dirView.setUint32(0, 0x02014b50, true)
    dirView.setUint16(4, 20, true)
    dirView.setUint16(6, 20, true)
    dirView.setUint16(8, 0x0800, true)
    dirView.setUint16(10, 0, true)
    dirView.setUint16(12, time, true)
    dirView.setUint16(14, date, true)
    dirView.setUint32(16, crc, true)
    dirView.setUint32(20, size, true)
    dirView.setUint32(24, size, true)
    dirView.setUint16(28, nameBytes.length, true)
    dirView.setUint32(42, offset, true)
    dir.set(nameBytes, 46)
    central.push(dir)

    offset += local.length + size
  }

  const centralSize = central.reduce((sum, chunk) => sum + chunk.length, 0)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  endView.setUint32(0, 0x06054b50, true)
  endView.setUint16(8, entries.length, true)
  endView.setUint16(10, entries.length, true)
  endView.setUint32(12, centralSize, true)
  endView.setUint32(16, offset, true)

  const total = offset + centralSize + 22
  const out = new Uint8Array(total)
  let cursor = 0
  for (const chunk of [...chunks, ...central, end]) {
    out.set(chunk, cursor)
    cursor += chunk.length
  }
  return out
}

/** btoa works on binary strings only, so long payloads convert in chunks. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}
