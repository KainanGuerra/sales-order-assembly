// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },

  // The app is a single-page client: the seller works on a phone and later
  // offline. The Nitro server stays: it is the BFF (session and backend calls).
  ssr: false,

  modules: ['@nuxt/ui', '@pinia/nuxt', '@nuxtjs/i18n', '@vite-pwa/nuxt'],
  css: ['~/assets/css/main.css'],

  i18n: {
    defaultLocale: 'pt-BR',
    strategy: 'no_prefix',
    locales: [{ code: 'pt-BR', language: 'pt-BR', name: 'Português', file: 'pt-BR.json' }],
  },

  // The app's one HTML page is written to a file at build time, so the service
  // worker has something to keep (an SPA has no other page).
  nitro: { prerender: { routes: ['/'] } },

  // Offline (phase C): a service worker keeps the app's own files on the phone,
  // so the app opens without signal, and keeps the last answer of the few reads
  // an offline order needs (who is logged in, the clients). Everything else goes
  // to the network. The orders waiting to be sent are not here: the page keeps
  // them (stores/pending.ts). Only works in the production build.
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Pedidos',
      short_name: 'Pedidos',
      lang: 'pt-BR',
      display: 'standalone',
      start_url: '/',
      background_color: '#ffffff',
      theme_color: '#ffffff',
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      // Any page address opens the app; the server's own routes are not pages.
      navigateFallback: '/',
      navigateFallbackDenylist: [/^\/api\//],
      cleanupOutdatedCaches: true,
      runtimeCaching: [
        {
          // Network first, but after 5 s (before the page gives up at 8 s) the
          // last answer is used. Emptied at login and logout (useSession).
          urlPattern: ({ url }: { url: URL }) =>
            url.pathname === '/api/auth/me' || url.pathname === '/api/clients' || /^\/api\/clients\/[^/]+$/.test(url.pathname),
          handler: 'NetworkFirst',
          options: { cacheName: 'api-reads', networkTimeoutSeconds: 5, cacheableResponse: { statuses: [200] } },
        },
      ],
    },
    devOptions: { enabled: false },
  },

  // Everything here is read on the server only. A key under `public` would be
  // shipped to the browser, so the shared secret never goes there.
  // Overridden by NUXT_<KEY> environment variables.
  runtimeConfig: {
    innerAuth: '',
    identityUrl: 'http://identity-api:3001',
    catalogUrl: 'http://catalog-api:3002',
    ordersUrl: 'http://orders-api:3003',
    notificationsUrl: 'http://notifications-api:3004',
    redisUrl: 'redis://redis:6379',
    session: {
      ttlSeconds: 8 * 60 * 60,
      // Turn on when the app is served over HTTPS.
      cookieSecure: false,
    },
  },
});
