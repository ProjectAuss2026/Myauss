import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { createContentSecurityPolicy } from '../shared/securityHeaders.mjs'

const createSecurityHeaders = ({
  env,
  allowEval,
  allowInlineScripts,
  allowWebSockets,
}: {
  env: Record<string, string>
  allowEval: boolean
  allowInlineScripts: boolean
  allowWebSockets: boolean
}) => ({
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': createContentSecurityPolicy({
    env,
    allowEval,
    allowInlineScripts,
    allowWebSockets,
  }),
})

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(process.cwd(), '..'), '')
  const backendPort = env.VITE_BACKEND_PORT || '3001'
  const devSecurityHeaders = createSecurityHeaders({
    env,
    allowEval: true,
    allowInlineScripts: true,
    allowWebSockets: true,
  })
  const previewSecurityHeaders = createSecurityHeaders({
    env,
    allowEval: false,
    allowInlineScripts: false,
    allowWebSockets: false,
  })

  console.log(`[Vite] Proxying /api → http://localhost:${backendPort}`)
  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5174,
      headers: devSecurityHeaders,
      proxy: {
        '/api': {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/uploads': {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        }
      }
    },
    preview: {
      headers: previewSecurityHeaders,
    },
    assetsInclude: ['**/*.svg', '**/*.csv'],
  }
})
