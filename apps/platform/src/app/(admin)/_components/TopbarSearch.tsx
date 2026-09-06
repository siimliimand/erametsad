import { Search } from 'lucide-react'

/**
 * Global search stub: disabled input so the operator is not shown a dead
 * affordance. The real search endpoint is deferred; this renders no state.
 */
export function TopbarSearch() {
  return (
    <div className="relative hidden h-9 w-full max-w-[420px] items-center gap-2 rounded-[8px] border border-transparent bg-bgMist px-2.5 md:flex mx-auto">
      <Search className="h-4 w-4 shrink-0 text-inkMuted" />
      <input
        type="search"
        disabled
        placeholder="Otsi oksjoneid, kasutajaid, juhtlõimi..."
        aria-label="Globaalne otsing (veel ei ole saadaval)"
        className="flex-1 min-w-0 border-0 bg-transparent text-[13px] leading-[18px] text-ink outline-none placeholder:text-inkMuted disabled:cursor-not-allowed"
      />
      <kbd className="rounded-[6px] border border-border bg-bgPage px-1.5 font-mono text-[11px] leading-4 font-medium text-inkMuted">
        ⌘K
      </kbd>
    </div>
  )
}
