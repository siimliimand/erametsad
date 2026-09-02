import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono, Public_Sans } from 'next/font/google'

import '../../../../packages/ui/src/styles/tokens.css'
import './globals.css'

const publicSans = Public_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['600', '700'],
  variable: '--font-heading',
})

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500'],
  variable: '--font-mono',
  style: 'normal',
})

export const metadata: Metadata = {
  title: 'Erametsad',
  description: 'Eesti metsatehingute platvorm',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="et"
      className={`${publicSans.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="antialiased">{children}</body>
    </html>
  )
}