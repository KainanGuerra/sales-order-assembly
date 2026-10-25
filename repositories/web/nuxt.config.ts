// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },

  // The app is a single-page client: the seller works on a phone and later
  // offline. The Nitro server stays: it is the BFF (session and backend calls).
  ssr: false,

  modules: ['@nuxt/ui', '@pinia/nuxt', '@nuxtjs/i18n'],
  css: ['~/assets/css/main.css'],

  i18n: {
    defaultLocale: 'pt-BR',
    strategy: 'no_prefix',
    locales: [{ code: 'pt-BR', language: 'pt-BR', name: 'Português', file: 'pt-BR.json' }],
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
