// Internationalization context that resolves locale from storage or browser before first render

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import en from './locales/en.json'
import es from './locales/es.json'
import it from './locales/it.json'
import pt from './locales/pt.json'

export type Locale = 'en' | 'es' | 'it' | 'pt'

type TranslationValue = string | TranslationMap
interface TranslationMap {
  [key: string]: TranslationValue
}

type Dictionary = Record<Locale, TranslationMap>

type ReplacementValues = Record<string, string | number>

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: string) => void
  availableLocales: Locale[]
  t: (key: string, replacements?: ReplacementValues) => string
}

// LocalStorage key used to persist user language
const STORAGE_KEY = 'folderlan:locale'
// Fallback language when detection fails
const FALLBACK_LOCALE: Locale = 'en'
// Explicit list of supported locales
export const SUPPORTED_LOCALES: Locale[] = ['en', 'es', 'it', 'pt']

// Translation dictionaries mapped by locale
const translations: Dictionary = {
  en: en as TranslationMap,
  es: es as TranslationMap,
  it: it as TranslationMap,
  pt: pt as TranslationMap,
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined)

// Normalizes locale strings like es-ES or en_US to base locale
const normalizeLocale = (value: string | null | undefined): Locale => {
  if (!value) return FALLBACK_LOCALE
  const candidate = value.toLowerCase().split(/[-_]/)[0] as Locale
  return SUPPORTED_LOCALES.includes(candidate) ? candidate : FALLBACK_LOCALE
}

// Detects browser preferred language synchronously
const detectBrowserLocale = (): Locale => {
  if (typeof navigator === 'undefined') return FALLBACK_LOCALE
  return normalizeLocale(navigator.language)
}

// Reads persisted locale from localStorage if available
const getStoredLocale = (): Locale | undefined => {
  if (typeof window === 'undefined') return undefined
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored ? normalizeLocale(stored) : undefined
  } catch {
    return undefined
  }
}

// Resolves initial locale before first render
const resolveInitialLocale = (): Locale => {
  // Prefer persisted locale if present
  const stored = getStoredLocale()
  if (stored) return stored
  // Fallback to browser language
  return detectBrowserLocale()
}

interface I18nProviderProps {
  children: ReactNode
}

// I18n provider with synchronous locale resolution
export const I18nProvider = ({ children }: I18nProviderProps) => {
  // Initialize locale before first render to avoid English flash
  const [locale, setLocaleState] = useState<Locale>(() => resolveInitialLocale())

  // Sync document language attribute and persist locale
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', locale)
    }

    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, locale)
      } catch {
        /* Ignore persistence errors */
      }
    }
  }, [locale])

  // Public locale setter with normalization
  const setLocale = useCallback((nextLocale: string) => {
    setLocaleState((current) => {
      const normalized = normalizeLocale(nextLocale)
      return current === normalized ? current : normalized
    })
  }, [])

  // Active translation dictionary
  const dictionary = useMemo<TranslationMap>(
    () => translations[locale] ?? translations[FALLBACK_LOCALE],
    [locale]
  )

  // Translation function with nested keys, replacements, and plural support
  const translate = useCallback(
    (key: string, replacements: ReplacementValues = {}) => {
      if (!key) return ''

      const segments = key.split('.')
      let pointer: TranslationValue | undefined = dictionary
      let parent: TranslationMap | null = null
      let lastSegment: string | null = null

      for (const segment of segments) {
        if (pointer && typeof pointer === 'object' && segment in pointer) {
          parent = pointer as TranslationMap
          lastSegment = segment
          pointer = parent[segment]
        } else {
          pointer = undefined
          break
        }
      }

      const { count } = replacements
      if (typeof count === 'number' && parent && lastSegment && count !== 1) {
        const pluralKey = `${lastSegment}_plural`
        if (pluralKey in parent) {
          pointer = parent[pluralKey]
        }
      }

      if (typeof pointer === 'string') {
        return pointer.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, token) =>
          token in replacements ? String(replacements[token]) : match
        )
      }

      return pointer == null ? key : String(pointer)
    },
    [dictionary]
  )

  const contextValue = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      availableLocales: SUPPORTED_LOCALES,
      t: translate,
    }),
    [locale, setLocale, translate]
  )

  return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>
}

// Hook to consume the I18n context safely
export const useI18n = (): I18nContextValue => {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider')
  }
  return context
}
