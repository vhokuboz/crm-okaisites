import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5173 },
  build: {
    rollupOptions: {
      // Vendors em chunks proprios: mudar o app nao invalida o cache deles.
      output: {
        manualChunks: (id) =>
          id.includes('@supabase') ? 'supabase' : /node_modules\/(react|react-dom|scheduler)\//.test(id) ? 'react' : undefined,
      },
    },
  },
})
