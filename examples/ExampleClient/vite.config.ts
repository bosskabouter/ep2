import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import basicSsl from '@vitejs/plugin-basic-ssl'
// https://vitejs.dev/config/
export default defineConfig({
  server: { https: true },
  // preview: { https: true },
  plugins: [react(), basicSsl(),
    // https://vite-pwa-org.netlify.app/guide/
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'out-sw',
      filename: 'sw.js',
      injectRegister: 'script',
      mode: 'development',
      // outDir: 'dist',

      // registerType: 'autoUpdate',
      // injectManifest: {
      //   injectionPoint: undefined
      // },
      devOptions: {
        type: 'module',
        enabled: true,
        navigateFallbackAllowlist: [/^index.html$/]
      },

      manifest: {
        name: 'My App',
        short_name: 'My App',
        icons: [
          // {
          //   src: '/img/icons/android-chrome-192x192.png',
          //   sizes: '192x192',
          //   type: 'image/png'
          // },
          // {
          //   src: '/img/icons/android-chrome-512x512.png',
          //   sizes: '512x512',
          //   type: 'image/png'
          // }
        ],
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone'
      },
      workbox: {
        swDest: 'my-dist/my-sw.js',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/localhost\//,
            handler: 'NetworkFirst'
          }
        ]
      }
    })]
})
