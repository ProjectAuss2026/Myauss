import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { CSP_IMAGE_SRC_VALUES } from '../shared/securityHeaders.mjs'

const createContentSecurityPolicy = ({
  allowEval,
  allowInlineScripts,
  allowWebSockets,
}: {
  allowEval: boolean
  allowInlineScripts: boolean
  allowWebSockets: boolean
}) => {
  const connectSrcValues = ["'self'", ...(allowWebSockets ? ['ws:', 'wss:'] : [])]

  return [
    "default-src 'self'",
    `script-src 'self'${allowInlineScripts ? " 'unsafe-inline'" : ''}${allowEval ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline' https:",
    `img-src ${CSP_IMAGE_SRC_VALUES.join(' ')}`,
    "font-src 'self' data: https:",
    `connect-src ${connectSrcValues.join(' ')}`,
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}

const SHARED_SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-Frame-Options': 'DENY',
}

const DEV_SECURITY_HEADERS = {
  ...SHARED_SECURITY_HEADERS,
  'Content-Security-Policy': createContentSecurityPolicy({
    allowEval: true,
    allowInlineScripts: true,
    allowWebSockets: true,
  }),
}

const PREVIEW_SECURITY_HEADERS = {
  ...SHARED_SECURITY_HEADERS,
  'Content-Security-Policy': createContentSecurityPolicy({
    allowEval: false,
    allowInlineScripts: false,
    allowWebSockets: false,
  }),
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(process.cwd(), '..'), '')
  const backendPort = env.VITE_BACKEND_PORT || '3001'
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
      headers: DEV_SECURITY_HEADERS,
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
      headers: PREVIEW_SECURITY_HEADERS,
    },
    assetsInclude: ['**/*.svg', '**/*.csv'],
  }
})
