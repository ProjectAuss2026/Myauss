import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const IMAGE_SRC_VALUES = [
  "'self'",
  'data:',
  'blob:',
  'https://prodcdn.sporty.co.nz',
  'https://images.squarespace-cdn.com',
  'https://www.lskd.co',
  'https://upload.wikimedia.org',
  'https://nevafoldcollection.com',
  'https://avancus.com',
  'https://assets.shipcode.com',
  'https://images.pixieset.com',
]

const SECURITY_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https:",
    `img-src ${IMAGE_SRC_VALUES.join(' ')}`,
    "font-src 'self' data: https:",
    "connect-src 'self' http: https: ws: wss:",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-Frame-Options': 'DENY',
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
      headers: SECURITY_HEADERS,
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
      headers: SECURITY_HEADERS,
    },
    assetsInclude: ['**/*.svg', '**/*.csv'],
  }
})
