// Configuration loader for environment variables with fallback values.

interface EnvConfig {
  readonly API_URL: string
}

// Load and validate environment variables, providing sensible defaults
function loadEnv(): EnvConfig {
  const rawEnv = import.meta.env

  const config: EnvConfig = {
    API_URL: rawEnv.VITE_API_URL ?? window.location.origin,
  }

  return config
}

// Exported singleton configuration instance
export const envConfig = loadEnv()
