// React context that manages the application theme and syncs it with browser UI.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { setThemeColor } from '@utils/setThemeColor'

export type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme | string) => void
  toggleTheme: () => void
}

const STORAGE_KEY = 'folderlan:theme'
const FALLBACK_THEME: Theme = 'light'

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const prefersDarkMode = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

const normalizeTheme = (value: string | null | undefined): Theme => {
  if (!value) return FALLBACK_THEME
  return value.toLowerCase() === 'dark' ? 'dark' : 'light'
}

const getInitialTheme = (): Theme => {
  if (typeof window === 'undefined') {
    return FALLBACK_THEME
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return normalizeTheme(stored)
    }
  } catch (error) {
    console.warn('[theme] Unable to read stored theme.', error)
  }

  return prefersDarkMode() ? 'dark' : FALLBACK_THEME
}

interface ThemeProviderProps {
  children: ReactNode
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => getInitialTheme())

  // Persist theme in localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme)
    } catch (error) {
      console.warn('[theme] Unable to persist theme.', error)
    }
  }, [theme])

  // Sync browser UI and document with current theme
  useEffect(() => {
    const color = theme === 'dark' ? '#020617' : '#ffffff'
    setThemeColor(color)
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Listen to system theme changes
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

      const handleChange = (event: MediaQueryListEvent) => {
        setThemeState(event.matches ? 'dark' : 'light')
      }

      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }

    return undefined
  }, [])

  const setTheme = useCallback((nextTheme: Theme | string) => {
    setThemeState(normalizeTheme(nextTheme))
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      toggleTheme,
    }),
    [theme, setTheme, toggleTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
