/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { svelteTesting } from "@testing-library/svelte/vite";

// Served from the root of the custom domain grouper.pladypus.dev (once deployed, #26).
export default defineConfig({
  base: "/",
  plugins: [svelte(), tailwindcss(), svelteTesting()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
  },
});
