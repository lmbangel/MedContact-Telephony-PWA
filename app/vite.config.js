import { defineConfig } from 'vite'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  base: '/app/',
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        // Main entry - auth router
        main: resolve(__dirname, 'index.html'),

        // Phone/Softphone app
        phone: resolve(__dirname, 'phone.html'),
        login: resolve(__dirname, 'login.html'),
        register: resolve(__dirname, 'register.html'),

        // Dashboard pages
        dashboardLogin: resolve(__dirname, 'dashboard-login.html'),
        dashboardRegister: resolve(__dirname, 'dashboard-register.html'),
        dashboardHome: resolve(__dirname, 'dashboard-home.html')
      }
    }
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: 'localhost'
      }
    }
  }
})
