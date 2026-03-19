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
      <body className="min-h-screen antialiased relative overflow-x-hidden">
        <div className="bg-orb-blue" />
        <div className="bg-orb-purple" />
        <nav className="glass-card rounded-none border-x-0 border-t-0 sticky top-0 z-50 px-4 py-3 flex items-center justify-between">
          <Link
            href="/"
            className="font-semibold text-lg bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent"
          >
            TwitterMultiLang Hub
          </Link>
          <Link
            href="/config"
            className="text-sm text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
          >
            ⚙️ Config
          </Link>
        </nav>
        <main className="relative z-10 max-w-7xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  )
}
