import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'
import vercel from '@astrojs/vercel'

// Astro 6: output "static" es ahora el modo híbrido por defecto.
// Las páginas se prerenderizan; las rutas API usan `export const prerender = false`.
export default defineConfig({
  output: 'static',
  adapter: vercel(),
  vite: {
    plugins: [tailwindcss()],
  },
})
