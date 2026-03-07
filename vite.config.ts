// CLI shim for shadcn — not used by electron-vite at runtime
import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  resolve: { alias: { '@renderer': resolve('src/renderer/src') } },
  plugins: [react(), tailwindcss()],
})
