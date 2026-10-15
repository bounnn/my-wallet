// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ["@vite-pwa/nuxt", "@nuxt/ui"],
  css: ["~/assets/css/main.css"],
  compatibilityDate: "2025-07-15",
  devtools: { enabled: false },
  ssr: false,
  // Dark mode only: always dark, ignoring the system setting and any saved preference
  colorMode: {
    preference: "dark",
    fallback: "dark",
    storageKey: "my-wallet-color-mode",
  },
  app: {
    head: {
      htmlAttrs: { class: "dark" },
      meta: [
        { name: "theme-color", content: "#060b1a" },
        { name: "color-scheme", content: "dark" },
        {
          name: "viewport",
          // resizes-content: Android shrinks the page for the keyboard, keeping bottom actions visible.
          // No zoom (app-like); iOS ignores user-scalable, see plugins/no-zoom.client.ts
          content:
            "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content",
        },
        {
          name: "apple-mobile-web-app-status-bar-style",
          content: "black-translucent",
        },
      ],
    },
  },
  pwa: {
    registerType: "autoUpdate",
    manifest: {
      name: "My Wallet",
      short_name: "My Wallet",
      description: "Personal wallet tracker",
      theme_color: "#060b1a",
      background_color: "#060b1a",
      display: "standalone",
      orientation: "portrait",
    },
    pwaAssets: {
      config: true,
    },
    workbox: {
      globPatterns: ["**/*.{js,css,html,png,svg,ico,woff2}"],
      // The app's base path: "/" locally, "/my-wallet/" on GitHub Pages (NUXT_APP_BASE_URL, set by the deploy workflow)
      navigateFallback: process.env.NUXT_APP_BASE_URL || "/",
    },
    client: {
      installPrompt: true,
    },
    devOptions: {
      enabled: true,
      type: "module",
      // The dev service worker has no built files to precache, so workbox warns about every glob
      suppressWarnings: true,
    },
  },
});
