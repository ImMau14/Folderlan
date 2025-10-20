import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"
import path from "node:path"

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_")
  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@components": path.resolve(__dirname, "./src/components"),
        "@utils": path.resolve(__dirname, "./src/utils"),
        "@pages": path.resolve(__dirname, "./src/pages"),
        "@assets": path.resolve(__dirname, "./src/assets"),
        "@styles": path.resolve(__dirname, "./src/styles"),
        "@guards": path.resolve(__dirname, "./src/guards"),
        "@routes": path.resolve(__dirname, "./src/routes"),
      },
    },
    define: {
      __APP_API_PATH: JSON.stringify(env.VITE_API_PATH),
    },
  }
})
