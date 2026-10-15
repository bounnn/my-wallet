// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ["@vite-pwa/nuxt", "@nuxt/ui"],
  css: ["~/assets/css/main.css"],
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
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
        { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
        { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
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
      navigateFallback: "/",
    },
    client: {
      installPrompt: true,
    },
    devOptions: {
      enabled: true,
      type: "module",
    },
  },
});
