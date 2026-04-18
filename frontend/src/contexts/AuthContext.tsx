// Provides a React Context for authentication state and token management.

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useCallback,
  useState,
  type ReactNode,
} from "react"

// Key used to store the auth token in localStorage
const TOKEN_KEY = "auth_token"
// Key used to store the token creation timestamp in localStorage
const TOKEN_TS_KEY = "auth_token_ts"
// Token Time-To-Live in milliseconds (1 hour)
const TOKEN_TTL_MS = 60 * 60 * 1000 // 1h

// Shape of the context value exposed to consumers
interface AuthContextValue {
  token: string | null
  // True when there is a token AND it has not expired according to TTL
  isAuthenticated: boolean
  // Save token and mark user as authenticated
  login: (token: string) => void
  // Clear token and mark user as unauthenticated
  logout: () => void
  // Re-validate token TTL and logout if expired
  refresh: () => void
}

// Create context with nullable default to force provider usage check
const AuthContext = createContext<AuthContextValue | null>(null)

// Read token string from localStorage. Returns null on failure or if not present.
function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch (err) {
    // Fail quietly but log to help debugging in restricted environments
    console.error("readToken error:", err)
    return null
  }
}

// Read timestamp (ms since epoch) from localStorage. Returns null on failure/invalid value.
function readTimestamp(): number | null {
  try {
    const ts = localStorage.getItem(TOKEN_TS_KEY)
    if (!ts) return null
    const parsed = parseInt(ts, 10)
    return Number.isNaN(parsed) ? null : parsed
  } catch (err) {
    console.error("readTimestamp error:", err)
    return null
  }
}

// Return true if token timestamp exists and age is less than TTL
function isTokenValid(): boolean {
  try {
    const ts = readTimestamp()
    if (!ts) return false
    const age = Date.now() - ts
    if (Number.isNaN(age)) return false
    return age < TOKEN_TTL_MS
  } catch (err) {
    console.error("isTokenValid error:", err)
    return false
  }
}

// Persist token and current timestamp to localStorage
function persistToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(TOKEN_TS_KEY, Date.now().toString())
  } catch (err) {
    console.error("persistToken error:", err)
  }
}

// Remove token and timestamp from localStorage
function clearStorage() {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(TOKEN_TS_KEY)
  } catch (err) {
    console.error("clearStorage error:", err)
  }
}

// AuthProvider wraps the app and provides authentication state and actions.
// It initializes state from localStorage and enforces TTL on mount.
export function AuthProvider({ children }: { children: ReactNode }) {
  // Local token state is the single source of truth for React components.
  const [token, setToken] = useState<string | null>(null)

  // Initial load: read token and validate TTL. If expired, clear storage.
  useEffect(() => {
    try {
      if (isTokenValid()) {
        setToken(readToken())
      } else {
        clearStorage()
        setToken(null)
      }
    } catch (err) {
      console.error("AuthProvider init error:", err)
      clearStorage()
      setToken(null)
    }

    // Intentionally run only once on mount
  }, [])

  // Save a new token and update state
  const login = (newToken: string) => {
    persistToken(newToken)
    setToken(newToken)
  }

  // Remove token and update state
  const logout = () => {
    clearStorage()
    setToken(null)
  }

  // Re-validate token TTL. If expired, perform logout.
  // Call this when you want to explicitly check token freshness.
  const refresh = useCallback(() => {
    if (!isTokenValid()) {
      logout()
    } else {
      // If still valid, refresh timestamp to extend TTL (optional behavior).
      // If you prefer not to reset TTL on refresh, comment out the next two lines.
      const current = readToken()
      if (current) persistToken(current)
    }
  }, [])

  // Memoize context value so consumers only re-render when token changes or refresh.
  // isAuthenticated is true only when token exists AND timestamp is valid.
  const value = useMemo<AuthContextValue>(() => {
    const valid = Boolean(token) && isTokenValid()
    return {
      token,
      isAuthenticated: valid,
      login,
      logout,
      refresh,
    }
  }, [token, refresh])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Custom hook to consume AuthContext. Throws if used outside provider to avoid silent failures.
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider")
  }
  return ctx
}
