import type { Metadata } from 'next'
import './globals.css'
import TeamNavWrapper from '@/components/TeamNavWrapper'
import ThemeProvider from '@/components/ThemeProvider'

export const metadata: Metadata = {
  title: 'Coordina',
  description: 'Agentic Teams Platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Anti-FOUC: apply stored theme before React hydrates */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem('theme');if(t==='light')document.documentElement.classList.remove('dark');})();` }} />
      </head>
      <body className="flex h-screen overflow-hidden">
        <ThemeProvider>
          <TeamNavWrapper />
          <main className="flex-1 overflow-hidden min-w-0">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  )
}
