// Configuration loader for environment variables with fallback values.

import { z } from 'zod'

const EnvConfigSchema = z.object({
  API_URL: z.union([z.string().url(), z.literal('localhost')]).readonly(),
})

type EnvConfig = z.infer<typeof EnvConfigSchema>

// Load and validate environment variables, providing sensible defaults
function loadEnv(): EnvConfig {
  const rawEnv = import.meta.env

  const getUrl: (url: string) => string = (url: string) => {
    if (!url) {
      return window.location.origin
    }

    if (url === 'localhost') {
      const api_path = new URL(window.location.origin)
      api_path.port = '8080'
      return api_path.href
    }

    return url
  }

  const config: EnvConfig = {
    API_URL: getUrl(rawEnv.VITE_API_URL),
  }

  const parsedConfig = EnvConfigSchema.safeParse(config)

  if (!parsedConfig.success) {
    throw new TypeError(`No valid environment variables was detected`)
  }

  return parsedConfig.data
}

// Exported singleton configuration instance
export const envConfig = loadEnv()
