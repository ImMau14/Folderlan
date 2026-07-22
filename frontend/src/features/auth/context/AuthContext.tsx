/**
 * Provides authentication state and token management via React Context.
 * Stores token, user data (including username and role) in localStorage and enforces TTL.
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

const TOKEN_KEY = "auth_token"
const TOKEN_TS_KEY = "auth_token_ts"
const USER_KEY = "auth_user"
const TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour

/**
 * Represents the authenticated user.
 * Roles match the backend: 'owner' or 'visitor'.
 */
export interface User {
  username: string
  role: "owner" | "visitor"
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    try {
      if (isTokenValid()) {
        setToken(readToken())
        setUser(readUser())
      } else {
        clearStorage()
      }
    } catch {
      clearStorage()
    }
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
