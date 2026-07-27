import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative asset URLs so one build works at a domain root (Cloudflare, Vercel)
  // and under a sub-path — GitHub Pages serves this at /geogrid/.
  base: './',
  // Honour a PORT from the environment so a preview harness can assign one.
  server: process.env.PORT ? { port: Number(process.env.PORT), strictPort: true } : undefined,
})
