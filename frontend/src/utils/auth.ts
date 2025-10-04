// Token management utilities for handling authentication token storage and validation
// in the browser's localStorage with TTL (Time To Live) support

export const TOKEN_KEY = "auth_token"
export const TOKEN_TS_KEY = "auth_token_ts"
export const TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour in ms

// Save token and timestamp to localStorage
export function saveToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(TOKEN_TS_KEY, Date.now().toString())
  } catch (err) {
    console.error("saveToken error:", err)
  }
}

// Retrieve token from localStorage
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

// Remove token and timestamp from localStorage
export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(TOKEN_TS_KEY)
  } catch (err) {
    console.error("clearToken error:", err)
  }
}

// Check if token exists and hasn't expired based on TTL
export function isTokenValid(): boolean {
  try {
    const ts = localStorage.getItem(TOKEN_TS_KEY)
    if (!ts) return false
    const age = Date.now() - parseInt(ts, 10)
    if (Number.isNaN(age)) return false
    return age < TOKEN_TTL_MS
  } catch (err) {
    console.error("isTokenValid error:", err)
    return false
  }
}

// Calculate token age in milliseconds since creation
export function tokenAgeMs(): number | null {
  const ts = localStorage.getItem(TOKEN_TS_KEY)
  if (!ts) return null
  const parsed = parseInt(ts, 10)
  if (Number.isNaN(parsed)) return null
  return Date.now() - parsed
}
