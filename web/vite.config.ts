import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Read version from package.json (npm) or APP_VERSION env var (Docker)
const appVersion = process.env.APP_VERSION || process.env.npm_package_version || '0.0.0-dev'
const buildTime = new Date().toISOString()

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __BUILD_TIME__: JSON.stringify(buildTime)
  },
  server: { host: '0.0.0.0', port: 1500 }
})
