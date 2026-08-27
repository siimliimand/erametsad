import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono, Manrope } from 'next/font/google'

import '../../../../packages/ui/src/styles/tokens.css'
import './globals.css'

const manrope = Manrope({
  subsets: ['latin', 'latin-ext'],
  weight: ['700', '800'],
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
  title: 'Eametsad',
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
      className={`${manrope.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="antialiased">{children}</body>
    </html>
  )
}