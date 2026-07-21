import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    tailwindcss(),
    viteSingleFile({
      // Garde le loader Vite hors du fichier final quand possible
      removeViteModuleLoader: false,
      useRecommendedBuildConfig: true,
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
    open: false,
    proxy: {
      // Permet dev sans WAMP : redirige /api vers un dossier local si existe, sinon mock
      "/api": {
        target: "http://localhost/barpos",
        changeOrigin: true,
        secure: false,
        // Si WAMP pas dispo, la requête échouera mais le store a un fallback offline
        configure: (proxy) => {
          proxy.on("proxyReq", () => {});
          proxy.on("error", () => {});
        },
      },
    },
  },
  preview: {
    port: 4173,
  },
  build: {
    target: "es2022",
    assetsInlineLimit: 100000000, // inline tout pour single file
    chunkSizeWarningLimit: 5000,
  },
});
