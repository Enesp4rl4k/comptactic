import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_ACTIONS ? '/comptactic/' : '/',
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/konva') || id.includes('node_modules/react-konva')) return 'konva'
          if (id.includes('node_modules/@supabase')) return 'supabase'
          if (id.includes('node_modules/jspdf') || id.includes('node_modules/html2canvas')) return 'pdf'
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) return 'react'
        },
      },
    },
  },
})
