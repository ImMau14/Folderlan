import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "node:path"
import { readFileSync } from "node:fs"

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, "./package.json"), "utf-8")) as {
  version: string
}

export default defineConfig(({ mode }) => {
  return {
    define: {
      "import.meta.env.APP_VERSION": JSON.stringify(pkg.version),
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@app": path.resolve(__dirname, "./src/app"),
        "@shared": path.resolve(__dirname, "./src/shared"),
        "@auth": path.resolve(__dirname, "./src/features/auth"),
        "@dashboard": path.resolve(__dirname, "./src/features/dashboard"),
        "@setup": path.resolve(__dirname, "./src/features/setup"),
        "@i18n": path.resolve(__dirname, "./src/features/i18n"),
        "@theme": path.resolve(__dirname, "./src/features/theme"),
        "@database": path.resolve(__dirname, "./src/features/database"),
        "@toast": path.resolve(__dirname, "./src/features/toast"),
        "@modal": path.resolve(__dirname, "./src/features/modal"),
      },
    },
  }
})
