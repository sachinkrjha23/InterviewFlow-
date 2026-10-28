import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { fs: { allow: [".."] } }, // /shared lives one folder above client/
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{js,jsx}"],
    setupFiles: ["./tests/setup.js"],
    css: false,
    env: {
      VITE_SERVER_URL: "http://localhost:1000",
      VITE_DEMO_ENABLED: "true",
    },
    testTimeout: 15000,
  },
});