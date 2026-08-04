// Language switcher component with dropdown menu and visual feedback.

import { useCallback, useEffect, useMemo, useRef, useState, type FC } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Languages, Check } from "lucide-react"
import { SUPPORTED_LOCALES, useI18n } from "@i18n/context/I18nContext"
import clsx from "clsx"

type LanguageSwitcherVariant = "default" | "mobile"

interface LanguageSwitcherProps {
  className?: string
  variant?: LanguageSwitcherVariant
}

interface LanguageOption {
  code: string
  label: string
}

const LANGUAGE_LABEL_KEYS: Record<string, string> = {
  en: "language.english",
  es: "language.spanish",
  it: "language.italian",
  pt: "language.portuguese",
}

export const LanguageSwitcher: FC<LanguageSwitcherProps> = ({ className, variant = "default" }) => {
  const { locale, setLocale, t } = useI18n()
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLUListElement | null>(null)

  const options = useMemo<LanguageOption[]>(() => {
    return SUPPORTED_LOCALES.map((code) => ({
      code,
      label: t(LANGUAGE_LABEL_KEYS[code] ?? LANGUAGE_LABEL_KEYS.en),
    })).filter((option) => Boolean(option.label))
  }, [t])

  const currentOption = useMemo(
    () => options.find((option) => option.code === locale) ?? options[0],
    [locale, options]
  )

  const toggleMenu = useCallback(() => {
    setIsOpen((prev) => !prev)
  }, [])

  const closeMenu = useCallback(() => {
    setIsOpen(false)
  }, [])

  const handleSelect = useCallback(
    (code: string) => {
      setLocale(code)
      closeMenu()
    },
    [closeMenu, setLocale]
  )

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node) &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        closeMenu()
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu()
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("touchstart", handleClickOutside)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("touchstart", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [closeMenu, isOpen])

  const buttonClasses = clsx(
    "group btn-glass relative flex items-center justify-center rounded-full text-ui-text backdrop-blur-md",
    variant === "mobile" ? "h-10 w-10" : "h-11 w-11",
    className
  )

  return (
    <div className={clsx("relative", className)}>
      <button
        type="button"
        ref={triggerRef}
        onClick={toggleMenu}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={buttonClasses}
      >
        <Languages className="h-5 w-5 text-ui-text" />
        <span className="sr-only">{`${t("language.label")}: ${currentOption?.label ?? locale.toUpperCase()}`}</span>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-full border border-transparent transition group-hover:border-ui-primary dark:group-hover:border-ui-primary"
        />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.ul
            ref={menuRef}
            role="listbox"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.18 }}
            className="glass absolute right-0 z-50 mt-3 w-48 overflow-hidden rounded-2xl p-2 text-sm font-medium backdrop-blur-md"
          >
            {options.map((option) => {
              const isActive = option.code === locale
              return (
                <li key={option.code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => handleSelect(option.code)}
                    className={clsx(
                      "flex w-full items-center justify-between rounded-xl px-3 py-2 transition hover:bg-ui-highlight/30 hover:text-ui-primary",
                      isActive ? "bg-ui-highlight/40 text-ui-primary" : "text-ui-text"
                    )}
                  >
                    <span>{option.label}</span>
                    {isActive && <Check className="h-4 w-4" />}
                  </button>
                </li>
              )
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
