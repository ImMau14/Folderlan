// Simple reusable loading component that shows a spinner and message.

import { useI18n } from "@i18n/context/I18nContext"
import { useTheme } from "@theme/context/ThemeContext"
import clsx from "clsx"

export interface LoadingPageProps {
  message?: string
  className?: string
}

export const LoadingPage = ({ message, className }: LoadingPageProps) => {
  const { t } = useI18n()
  const { theme } = useTheme()
  const resolvedMessage = message ?? t("loading.default")
  return (
    <div
      role="status"
      aria-live="polite"
      className={clsx(
        "h-full w-full bg-ui-base text-ui-text",
        theme === "dark" && "dark",
        className ?? ""
      )}
    >
      <div className="flex h-dvh items-center justify-center gap-2">
        <div
          className="h-5 w-5 animate-spin rounded-full border-4 border-ui-border border-t-ui-primary"
          aria-hidden
        />
        <span className="font-body text-sm">{resolvedMessage}</span>
      </div>
    </div>
  )
}

export default LoadingPage
