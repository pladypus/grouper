/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// Served from the root of the custom domain grouper.pladypus.dev.
export default defineConfig({
  base: "/",
  plugins: [
    react(),
    tailwindcss(),
    // SPEC §2 Offline: a service worker precaches the built app so the Home Screen app opens without
    // Wi-Fi. autoUpdate with the injected register script: a new version installs in the background
    // and takes effect on the next launch, with no update prompt (the page is never reloaded under
    // the Teacher).
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Grouper",
        short_name: "Grouper",
        description: "Shuffle your class into colour-coded Groups.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        // Theme tokens (src/styles.css): the top bar and the light page background.
        theme_color: "#1e1f24",
        background_color: "#f6f5f2",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      // Precached: the built JS/CSS/HTML (the default), includeAssets, the manifest and its icons.
    }),
  ],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
  },
});
