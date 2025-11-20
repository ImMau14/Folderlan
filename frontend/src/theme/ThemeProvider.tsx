import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

export type Theme = "light" | "dark"

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme | string) => void
  toggleTheme: () => void
}

const STORAGE_KEY = "folderlan:theme"
const FALLBACK_THEME: Theme = "light"

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const prefersDarkMode = (): boolean => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

const normalizeTheme = (value: string | null | undefined): Theme => {
  if (!value) return FALLBACK_THEME
  const lowered = value.toLowerCase()
  return lowered === "dark" ? "dark" : "light"
}

const getInitialTheme = (): Theme => {
  if (typeof window === "undefined") {
    return FALLBACK_THEME
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return normalizeTheme(stored)
    }
  } catch (error) {
    console.warn("[theme] Unable to read stored theme.", error)
  }

  return prefersDarkMode() ? "dark" : FALLBACK_THEME
}

const applyThemeToDocument = (theme: Theme) => {
  if (typeof document === "undefined") {
    return
  }

  const root = document.documentElement
  root.classList.toggle("dark", theme === "dark")
  root.classList.toggle("light", theme === "light")
  root.setAttribute("data-theme", theme)
  root.style.setProperty("color-scheme", theme)
}

interface ThemeProviderProps {
  children: ReactNode
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => getInitialTheme())

  useEffect(() => {
    applyThemeToDocument(theme)

    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, theme)
      } catch (error) {
        console.warn("[theme] Unable to persist theme.", error)
      }
    }
  }, [theme])

  useEffect(() => {
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")

      const handleChange = (event: MediaQueryListEvent) => {
        setThemeState((current) => {
          const inferred = event.matches ? "dark" : "light"
          return current === inferred ? current : inferred
        })
      }

      mediaQuery.addEventListener("change", handleChange)
      return () => mediaQuery.removeEventListener("change", handleChange)
    }

    return undefined
  }, [])

  const setTheme = useCallback((nextTheme: Theme | string) => {
    setThemeState((current) => {
      const normalized = normalizeTheme(nextTheme)
      return current === normalized ? current : normalized
    })
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((current) => (current === "dark" ? "light" : "dark"))
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      toggleTheme,
    }),
    [theme, setTheme, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
