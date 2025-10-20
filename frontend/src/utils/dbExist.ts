// Checks if the database exists

import { ApiClient } from "@utils/ApiClient"
import { API_PATH } from "@/constants"

// Log entry to confirm function is called
export async function dbExist(): Promise<boolean> {
  try {
    const client = new ApiClient({ baseURL: API_PATH, timeoutMs: 30000 })
    const response = await client.getDb()

    const exists =
      response?.data?.exists ?? response?.exists ?? response?.raw?.data?.exists ?? false

    return Boolean(exists)
  } catch (e) {
    console.log("[dbExist] error:", e)
    return false
  }
}
