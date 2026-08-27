import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Eametsad',
  description: 'Eesti metsatehingute platvorm',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="et">
      <body>{children}</body>
    </html>
  )
}