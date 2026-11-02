import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const project = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: resolve(project, "src"),
  base: "./",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: resolve(project, "dist"),
    emptyOutDir: true,
    target: "es2022",
    chunkSizeWarningLimit: 900,
  },
});
