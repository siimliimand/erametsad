import { env } from '../env'

declare global {
  interface R2Bucket {
    put(key: string, value: ArrayBuffer, options?: {
      httpMetadata?: { contentType?: string }
    }): Promise<R2Object>
    get(key: string): Promise<R2Object | null>
    delete(key: string): Promise<void>
    createSignedUrl(method: 'get' | 'put', key: string, options?: {
      expiresIn?: number
    }): Promise<string>
  }

  interface R2Object {
    key: string
    size: number
    httpMetadata?: { contentType?: string }
  }

  interface RequestContext {
    BUCKET?: R2Bucket
  }
}

export interface StorageFile {
  filename: string
  buffer: ArrayBuffer
  mimeType: string
  size: number
}

export interface Storage {
  upload(file: StorageFile): Promise<{ key: string; url: string }>
  delete(key: string): Promise<void>
  getSignedUrl(key: string): Promise<string | null>
}

export class R2Storage implements Storage {
  private bucket: R2Bucket

  constructor(binding: R2Bucket) {
    this.bucket = binding
  }

  async upload(file: StorageFile): Promise<{ key: string; url: string }> {
    const key = `${String(Date.now())}-${file.filename}`
    await this.bucket.put(key, file.buffer, {
      httpMetadata: { contentType: file.mimeType },
    })
    return { key, url: await this.getSignedUrl(key) ?? '' }
  }

  async delete(key: string): Promise<void> {
    await this.bucket.delete(key)
  }

  async getSignedUrl(key: string): Promise<string | null> {
    try {
      const obj = await this.bucket.get(key)
      if (!obj) return null

      const signed = await this.bucket.createSignedUrl('get', key, {
        expiresIn: 3600,
      })
      return signed
    } catch {
      return null
    }
  }
}

export class LocalStorage implements Storage {
  upload(file: StorageFile): Promise<{ key: string; url: string }> {
    const key = `${String(Date.now())}-${file.filename}`
    return Promise.resolve({ key, url: `/api/media/file/${key}` })
  }

  async delete(_key: string): Promise<void> {
    // no-op: Payload manages local filesystem
  }

  getSignedUrl(key: string): Promise<string | null> {
    return Promise.resolve(`/api/media/file/${key}`)
  }
}

let _storageInstance: Storage | null = null

export function createStorage(): Storage {
  if (_storageInstance) return _storageInstance

  if (env.R2_BUCKET) {
    throw new Error(
      'R2 storage requires a bucket binding. Set env.R2_BUCKET to truthy and pass the binding to createStorage(binding).'
    )
  }

  _storageInstance = new LocalStorage()
  return _storageInstance
}

export function createR2Storage(binding: R2Bucket): Storage {
  _storageInstance ??= new R2Storage(binding)
  return _storageInstance
}
