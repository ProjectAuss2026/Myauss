import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, resolve(process.cwd(), '..'), '')
  const backendPort = env.VITE_BACKEND_PORT || '3001'
  console.log(`[Vite] Proxying /api → http://localhost:${backendPort}`)
  return {
    plugins: [react()],
    server: {
      port: 5174,
      proxy: {
        '/api': {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        }
      }
    }
  }
})
