import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, '')
  const proxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:8000'
  const base = env.VITE_BASE_PATH || '/'
  const proxyApiKey = env.API_KEY_VALUE || env.VITE_API_KEY || ''

  const proxyCommon = {
    target: proxyTarget,
    changeOrigin: true,
    ...(proxyApiKey && {
      configure: (proxy) => {
        proxy.on('proxyReq', (proxyReq) => {
          proxyReq.setHeader('X-API-Key', proxyApiKey)
        })
      },
    }),
  }

  return {
    base,
    plugins: [react(), tailwindcss()],
    server: {
      host: true,
      allowedHosts: true,
      port: 5173,
      proxy: {
        '/api': proxyCommon,
        '/health': { target: proxyTarget, changeOrigin: true },
        ...(base !== '/' && {
          [`${base}api`]: {
            ...proxyCommon,
            rewrite: (path) => path.replace(new RegExp(`^${base}api`), '/api'),
          },
        }),
      },
    },
  }
})
