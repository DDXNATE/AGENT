import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Only expose variables starting with VITE_ to the browser

  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true,
    hmr: {
      clientPort: 443
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  // Security: Prevent secret keys from being bundled
  optimizeDeps: {
    exclude: ['dotenv']
  }
})
