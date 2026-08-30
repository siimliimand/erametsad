// Web-standard byte helpers. The node:crypto sync bridges accept Uint8Array
// everywhere the old code used Buffer, so the same bytes flow through both
// the canonical Web Crypto paths and these bridges.
const encoder = new TextEncoder()
const decoder = new TextDecoder()

export function utf8Encode(value: string): Uint8Array {
  return encoder.encode(value)
}

export function utf8Decode(value: Uint8Array): string {
  return decoder.decode(value)
}

export function toHex(value: Uint8Array): string {
  return Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function fromHex(value: string): Uint8Array {
  if (value.length % 2 !== 0) {
    throw new Error('hex string must have an even length')
  }
  const out = new Uint8Array(value.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

export function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}
