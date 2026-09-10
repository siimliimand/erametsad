import { API_ORIGIN } from './config'

/**
 * Prefixes the deployed API origin. Empty API_ORIGIN returns the path
 * unchanged, which keeps same-origin deployments (dev, workers.dev) on the
 * relative URL.
 */
export function apiUrl(path: string): string {
  return `${API_ORIGIN}${path}`
}

/**
 * fetch wrapper for browser API calls: prefixes the API origin and always
 * sends credentials, because cross-origin subdomain calls only carry the
 * shared session cookies with `credentials: 'include'`.
 */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), { ...init, credentials: 'include' })
}
