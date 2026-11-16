import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon-192.png", "icon-512.png", "apple-touch-icon.png"],
      manifest: {
        name: "HealthYarn — Voice Health Guidance",
        short_name: "HealthYarn",
        description:
          "Voice-first health information in Yorùbá, Igbo, and English with offline topic playback.",
        theme_color: "#0F523B",
        background_color: "#F7F6F2",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico}"],
        navigateFallbackDenylist: [/^\/api\//, /^\/static\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/static/audio/"),
            handler: "CacheFirst",
            options: {
              cacheName: "healthyarn-audio-v1",
              cacheableResponse: {
                statuses: [0, 200]
              },
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 60
              }
            }
          },
          {
            urlPattern: ({ url }) =>
              url.pathname === "/api/bundle" ||
              url.pathname === "/api/topics" ||
              url.pathname === "/api/meta" ||
              url.pathname === "/api/clinics",
            handler: "NetworkFirst",
            options: {
              cacheName: "healthyarn-api-v1",
              cacheableResponse: {
                statuses: [0, 200]
              },
              networkTimeoutSeconds: 4
            }
          }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true
      },
      "/static": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true
      }
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test-setup.ts"
  }
});
