import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    host: true,
    allowedHosts: [
      'perfect-vibrancy-production-8e35.up.railway.app',
      '.railway.app',
      '.up.railway.app',
      'localhost',
    ],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: true,
    allowedHosts: [
      'perfect-vibrancy-production-8e35.up.railway.app',
      '.railway.app',
      '.up.railway.app',
      'localhost',
    ],
  },
})
