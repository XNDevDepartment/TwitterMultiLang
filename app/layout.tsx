import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
  title: 'TwitterMultiLang Hub',
  description: 'Compose and publish tweets in 14 languages',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <Link href="/" className="font-semibold text-lg text-blue-600 hover:text-blue-700">
            TwitterMultiLang Hub
          </Link>
          <Link
            href="/config"
            className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
          >
            ⚙️ Config
          </Link>
        </nav>
        <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  )
}
