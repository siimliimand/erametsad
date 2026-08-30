export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** JSON fetch helper that surfaces the API's Estonian error messages. */
export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (init?.headers !== undefined) {
    const incoming = new Headers(init.headers)
    incoming.forEach((value, key) => {
      headers[key] = value
    })
  }
  const response = await fetch(url, { ...init, headers })
  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      typeof data === 'object' &&
      data !== null &&
      typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : 'Päring ebaõnnestus. Proovige uuesti.'
    throw new ApiError(message, response.status)
  }
  return data as T
}
