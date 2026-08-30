import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * Full-page chrome for the signing flows: they run outside the portal shell
 * because signing is a legally significant, focused task.
 */
export function SigningShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-bgMist">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex w-full max-w-container-sm items-center justify-between px-md py-sm">
          <Link href="/" className="font-heading text-h4 font-bold text-primary">
            Erametsad
          </Link>
          <Link
            href="/lepingud"
            className="font-label font-semibold text-inkMuted transition-colors duration-hover hover:text-primary"
          >
            Minu lepingud
          </Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-container-sm flex-1 flex-col justify-center px-md py-lg">
        {children}
      </main>
    </div>
  )
}
