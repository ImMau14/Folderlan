import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import en from "./locales/en.json"
import es from "./locales/es.json"
import it from "./locales/it.json"
import pt from "./locales/pt.json"

export type Locale = "en" | "es" | "it" | "pt"

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

const STORAGE_KEY = "folderlan:locale"
const FALLBACK_LOCALE: Locale = "en"
export const SUPPORTED_LOCALES: Locale[] = ["en", "es", "it", "pt"]

const translations: Dictionary = {
  en: en as TranslationMap,
  es: es as TranslationMap,
  it: it as TranslationMap,
  pt: pt as TranslationMap,
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined)

const normalizeLocale = (value: string | null | undefined): Locale => {
  if (!value) return FALLBACK_LOCALE
  const candidate = value.toLowerCase().split(/[-_]/)[0] as Locale
  return SUPPORTED_LOCALES.includes(candidate) ? candidate : FALLBACK_LOCALE
}

const detectBrowserLocale = (): Locale => {
  if (typeof navigator === "undefined") {
    return FALLBACK_LOCALE
  }

  const { language, languages } = navigator
  if (typeof language === "string" && language.length > 0) {
    return normalizeLocale(language)
  }

  if (Array.isArray(languages) && languages.length > 0) {
    return normalizeLocale(languages[0])
  }

  return FALLBACK_LOCALE
}

const getStoredLocale = (): Locale | undefined => {
  if (typeof window === "undefined") {
    return undefined
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored ? normalizeLocale(stored) : undefined
  } catch (error) {
    console.warn("[i18n] Unable to read stored locale.", error)
    return undefined
  }
}

interface I18nProviderProps {
  children: ReactNode
}

export const I18nProvider = ({ children }: I18nProviderProps) => {
  const [locale, setLocaleState] = useState<Locale>(FALLBACK_LOCALE)

  useEffect(() => {
    const stored = getStoredLocale()
    if (stored) {
      const normalizedStored = stored as Locale
      setLocaleState((current: Locale) => (current === normalizedStored ? current : normalizedStored))
      return
    }

    const detected = detectBrowserLocale()
    if (detected !== FALLBACK_LOCALE) {
      const normalizedDetected = detected as Locale
      setLocaleState((current: Locale) => (current === normalizedDetected ? current : normalizedDetected))
    }
  }, [])

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("lang", locale)
    }

    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, locale)
      } catch (error) {
        console.warn("[i18n] Unable to persist locale.", error)
      }
    }
  }, [locale])

  const setLocale = useCallback((nextLocale: string) => {
    setLocaleState((current: Locale) => {
      const normalized = normalizeLocale(nextLocale)
      return current === normalized ? current : normalized
    })
  }, [])

  const dictionary = useMemo<TranslationMap>(() => translations[locale] ?? translations[FALLBACK_LOCALE], [locale])

  const translate = useCallback(
    (key: string, replacements: ReplacementValues = {}) => {
      if (!key) return ""

      const segments = key.split(".")
      let pointer: TranslationValue | undefined = dictionary
      let parent: TranslationMap | null = null
      let lastSegment: string | null = null

      for (const segment of segments) {
        if (pointer && typeof pointer === "object" && segment in pointer) {
          parent = pointer as TranslationMap
          lastSegment = segment
          pointer = parent[segment]
        } else {
          pointer = undefined
          break
        }
      }

      const { count } = replacements
      if (typeof count === "number" && parent && lastSegment) {
        if (count !== 1) {
          const pluralKey = `${lastSegment}_plural`
          if (pluralKey in parent) {
            pointer = parent[pluralKey]
          }
        }
      }

      if (typeof pointer === "string") {
        return pointer.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, token) => {
          if (token in replacements) {
            return String(replacements[token])
          }
          return match
        })
      }

      if (pointer == null) {
        return key
      }

      return String(pointer)
    },
    [dictionary],
  )

  const contextValue = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      availableLocales: SUPPORTED_LOCALES,
      t: translate,
    }),
    [locale, setLocale, translate],
  )

  return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>
}

export const useI18n = (): I18nContextValue => {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider")
  }

  return context
}
