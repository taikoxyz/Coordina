import type { Metadata } from 'next'
import './globals.css'
import TeamNavWrapper from '@/components/TeamNavWrapper'

export const metadata: Metadata = {
  title: 'Coordina',
  description: 'Agentic Teams Platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex h-screen overflow-hidden" style={{ background: '#0a0a0a' }}>
        <TeamNavWrapper />
        <main className="flex-1 overflow-hidden min-w-0">
          {children}
        </main>
      </body>
    </html>
  )
}
