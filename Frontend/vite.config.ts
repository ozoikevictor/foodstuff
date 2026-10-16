import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

export default defineConfig(({ command }) => ({
  plugins: [
    tailwindcss(),
    tanstackStart({ server: { entry: "server" } }),
    ...(command === "build" ? [nitro({ preset: "vercel" })] : []),
    react(),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    dedupe: ["react", "react-dom", "@tanstack/react-query", "@tanstack/query-core"],
  },
  server: {
    host: "localhost",
    port: 8080,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:3003", changeOrigin: false } },
  },
}));
