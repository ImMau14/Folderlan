// Defines TypeScript interfaces for Vite environment variables type safety.

interface ImportMetaEnv {
  readonly VITE_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
