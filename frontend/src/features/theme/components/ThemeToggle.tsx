// Theme toggle button component with icon and text variants.

import { type FC } from "react"
import { Moon, Sun } from "lucide-react"

import { useTheme } from "@theme/context/ThemeContext"
import { useI18n } from "@i18n/context/I18nContext"

import clsx from "clsx"

type ThemeToggleVariant = "default" | "icon" | "mobile"

interface ThemeToggleProps {
  variant?: ThemeToggleVariant
  className?: string
}

export const ThemeToggle: FC<ThemeToggleProps> = ({ variant = "default", className }) => {
  const { theme, toggleTheme } = useTheme()
  const { t } = useI18n()
  const isDark = theme === "dark"

  const buttonClasses = clsx(
    "group btn-glass relative flex items-center justify-center rounded-full text-ui-text backdrop-blur-md",
    variant === "mobile" ? "h-10 w-10" : "h-11 w-11",
    className
  )

  const iconClass = "h-5 w-5 text-ui-text"

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={clsx(buttonClasses, className)}
      aria-label={isDark ? t("theme.ariaDark") : t("theme.ariaLight")}
    >
      {isDark ? <Moon className={iconClass} /> : <Sun className={iconClass} />}
      {variant === "default" && <span>{isDark ? t("theme.dark") : t("theme.light")}</span>}

      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-full border border-transparent transition group-hover:border-ui-primary dark:group-hover:border-ui-primary"
      />
    </button>
  )
}
