// Pure redirect validation rules (task 3.5): leading slash, no
// self-redirect, and the chain depth cap. The save action loads the
// existing redirects into a from→to map and runs these before any write.

export const MAX_REDIRECT_CHAIN_DEPTH = 3

/**
 * Rule check independent of stored rows: both paths must start with "/"
 * and the redirect must not point at itself. Returns an Estonian error
 * message, or null when acceptable.
 */
export function validateRedirectRules(from: string, to: string): string | null {
  if (!from.startsWith('/')) {
    return 'Algustee peab algama kaldkriipsuga (/).'
  }
  if (!to.startsWith('/')) {
    return 'Sihttee peab algama kaldkriipsuga (/).'
  }
  if (from === to) {
    return 'Suunamine ei tohi viia iseendale.'
  }
  return null
}

/**
 * Follows the chain starting at `to` and returns the hop count it adds
 * after this redirect is served, or null when the chain never terminates
 * (cycle or depth cap exceeded). Cycle-safe via the visited set; a chain
 * that reaches `from` closes a loop through the row being saved and also
 * reports null.
 */
export function redirectChainHopsAfter(
  from: string,
  to: string,
  byFrom: ReadonlyMap<string, string>,
): number | null {
  const visited = new Set<string>([from])
  let current = to
  let hops = 0
  while (!visited.has(current)) {
    const next = byFrom.get(current)
    if (next === undefined) return hops
    visited.add(current)
    current = next
    hops += 1
    if (hops > MAX_REDIRECT_CHAIN_DEPTH) return null
  }
  return null
}

/**
 * Full save-time validation: the path rules plus the chain depth cap over
 * the existing redirects map. Returns an Estonian error message, or null
 * when the redirect may be saved.
 */
export function validateRedirect(
  from: string,
  to: string,
  byFrom: ReadonlyMap<string, string>,
): string | null {
  const ruleError = validateRedirectRules(from, to)
  if (ruleError) return ruleError
  const hops = redirectChainHopsAfter(from, to, byFrom)
  if (hops === null) {
    return `Suunamiste kett on liiga pikk (lubatud on kuni ${String(MAX_REDIRECT_CHAIN_DEPTH)} hüpet).`
  }
  return null
}
