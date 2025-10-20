import { ApiClient } from "@utils/ApiClient"
import { API_PATH } from "@/constants"

export async function dbExist(): boolean {
  let exist = false

  const callExist = async () => {
    const client = new ApiClient({ baseURL: API_PATH, timeoutMs: 30000 })
    const response = await client.getDb()
    return response.wrapper
  }

  try {
    const resp = await callExist()
    exist = resp.exist
  } catch (e) {
    console.log(e)
  }

  return exist
}
