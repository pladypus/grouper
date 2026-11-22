/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { execSync } from "node:child_process";

/** The short commit being built, for the About dialog's version line; null outside a git checkout. */
function shortCommit(): string | null {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

// Served from the root of the custom domain grouper.pladypus.dev.
export default defineConfig({
  base: "/",
  // spec: screens.md#about-66: "Version <short commit> · <build date>" (read in src/buildInfo.ts).
  define: {
    __BUILD_COMMIT__: JSON.stringify(shortCommit()),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    tailwindcss(),
    // spec: stack-and-hosting.md (Offline): a service worker precaches the built app so the Home Screen app opens without
    // Wi-Fi. autoUpdate with the injected register script: a new version installs in the background
    // and takes effect on the next launch, with no update prompt (the page is never reloaded under
    // the Teacher).
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Grouper",
        short_name: "Grouper",
        // Same wording as og:description in index.html (#63).
        description:
          "A free classroom tool for teachers: split your class into random groups.",
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
    // Agent worktrees live under .claude/worktrees; only test this checkout.
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
