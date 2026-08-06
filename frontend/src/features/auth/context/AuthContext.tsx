/**
 * Provides authentication state and token management via React Context.
 * Stores token and user data (including username, role, and permission flags) in localStorage
 * and enforces TTL. Fetches full user info from /api/user/me on login/session restore.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useCallback,
  useState,
  type ReactNode,
} from "react"

import ApiClient from "@shared/utils/ApiClient"

const TOKEN_KEY = "auth_token"
const TOKEN_TS_KEY = "auth_token_ts"
const USER_KEY = "auth_user"
const TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour

/**
 * Represents the authenticated user with full permission flags.
 */
export interface User {
  id: number
  username: string
  role: "owner" | "visitor"
  can_upload: boolean
  can_delete_own_files: boolean
  has_upload_limits: boolean
  upload_limit: number
}

interface AuthContextValue {
  token: string | null
  user: User | null
  isAuthenticated: boolean
  login: (token: string, user: User) => void
  logout: () => void
  refresh: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

/* ---------- localStorage helpers ---------- */

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}
function readUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}
function readTimestamp(): number | null {
  try {
    const ts = localStorage.getItem(TOKEN_TS_KEY)
    if (!ts) return null
    const parsed = parseInt(ts, 10)
    return Number.isNaN(parsed) ? null : parsed
  } catch {
    return null
  }
}
function isTokenValid(): boolean {
  const ts = readTimestamp()
  if (!ts) return false
  return Date.now() - ts < TOKEN_TTL_MS
}
function persistSession(token: string, user: User) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(TOKEN_TS_KEY, Date.now().toString())
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch (e) {
    console.error("persistSession error:", e)
  }
}
function clearStorage() {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(TOKEN_TS_KEY)
    localStorage.removeItem(USER_KEY)
  } catch (e) {
    console.error("clearStorage error:", e)
  }
}

/**
 * Fetches the current user's full info from /api/user/me.
 * Returns null if the fetch fails (e.g., token expired, user inactive).
 */
async function fetchMe(token: string): Promise<User | null> {
  try {
    const client = new ApiClient()
    client.setToken(token)
    const result = await client.getMe()
    if (result.success && result.data.data) {
      return {
        id: result.data.data.id,
        username: result.data.data.username,
        role: result.data.data.role as "owner" | "visitor",
        can_upload: result.data.data.can_upload,
        can_delete_own_files: result.data.data.can_delete_own_files,
        has_upload_limits: result.data.data.has_upload_limits,
        upload_limit: result.data.data.upload_limit,
      }
    }
    return null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    async function init() {
      try {
        const storedToken = readToken()
        if (storedToken && isTokenValid()) {
          const freshUser = await fetchMe(storedToken)
          if (freshUser) {
            setToken(storedToken)
            setUser(freshUser)
            persistSession(storedToken, freshUser)
            return
          }
        }
      } catch {
        // fall through
      }
      clearStorage()
    }
    init()
  }, [])

  const login = useCallback((newToken: string, newUser: User) => {
    persistSession(newToken, newUser)
    setToken(newToken)
    setUser(newUser)
  }, [])

  const logout = useCallback(() => {
    clearStorage()
    setToken(null)
    setUser(null)
  }, [])

  const refresh = useCallback(() => {
    if (!isTokenValid()) {
      logout()
    } else {
      const currentToken = readToken()
      const currentUser = readUser()
      if (currentToken && currentUser) {
        persistSession(currentToken, currentUser)
      }
    }
  }, [logout])

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token) && isTokenValid(),
      login,
      logout,
      refresh,
    }),
    [token, user, login, logout, refresh]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}
