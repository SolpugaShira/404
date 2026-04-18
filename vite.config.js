import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true,
    historyApiFallback: true,
    proxy: {
      '/api': {
        target: 'https://sigma-ways.org',
        changeOrigin: true,
      },
      '/ws': {
        target: 'https://sigma-ways.org',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
