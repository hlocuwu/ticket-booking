import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
        '/api/auth': {
            target: 'http://localhost:8085',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api\/auth/, '')
        },
        '/api/events': {
            target: 'http://localhost:8084',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api\/events/, '')
        },
        '/api/queue': {
            target: 'http://localhost:8082',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api\/queue/, '')
        },
        '/api/booking': {
            target: 'http://localhost:8083',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api\/booking/, '')
        },
        '/api/inventory': {
            target: 'http://localhost:8081',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api\/inventory/, '')
        }
    }
  }
})
