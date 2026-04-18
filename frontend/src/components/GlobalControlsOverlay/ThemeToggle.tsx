// Theme toggle button component with icon and text variants.

import { type FC } from "react"
import { Moon, Sun } from "lucide-react"

import { useTheme } from "@contexts/ThemeContext"
import { useI18n } from "@contexts/I18nContext"

import clsx from "clsx"

type ThemeToggleVariant = "default" | "icon"

interface ThemeToggleProps {
  variant?: ThemeToggleVariant
  className?: string
}

export const ThemeToggle: FC<ThemeToggleProps> = ({ variant = "default", className }) => {
  const { theme, toggleTheme } = useTheme()
  const { t } = useI18n()
  const isDark = theme === "dark"

  const buttonClasses =
    variant === "icon"
      ? "flex h-11 w-11 items-center justify-center rounded-full border border-white/40 bg-white/70 text-slate-600 shadow-md backdrop-blur transition hover:border-brand-200 hover:text-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-brand-500 dark:hover:text-brand-300"
      : "flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur transition hover:border-brand-300 hover:text-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-brand-500"

  const iconClass = variant === "icon" ? "h-5 w-5" : "h-4 w-4"

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={clsx(buttonClasses, className)}
      aria-label={isDark ? t("theme.ariaDark") : t("theme.ariaLight")}
    >
      {isDark ? <Moon className={iconClass} /> : <Sun className={iconClass} />}
      {variant === "default" && <span>{isDark ? t("theme.dark") : t("theme.light")}</span>}
    </button>
  )
}
