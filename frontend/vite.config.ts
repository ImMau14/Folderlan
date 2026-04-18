import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "node:path"

export default defineConfig(({ mode }) => {
  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@components": path.resolve(__dirname, "./src/components"),
        "@utils": path.resolve(__dirname, "./src/utils"),
        "@config": path.resolve(__dirname, "./src/config"),
        "@pages": path.resolve(__dirname, "./src/pages"),
        "@assets": path.resolve(__dirname, "./src/assets"),
        "@styles": path.resolve(__dirname, "./src/styles"),
        "@guards": path.resolve(__dirname, "./src/guards"),
        "@contexts": path.resolve(__dirname, "./src/contexts"),
        "@i18n": path.resolve(__dirname, "./src/i18n"),
        "@theme": path.resolve(__dirname, "./src/theme"),
      },
    },
  }
})
