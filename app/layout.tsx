import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'QuikDB Demo - This Job Never Stops',
  description: 'Interactive demo showcasing QuikDB\'s always-on reliability',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
