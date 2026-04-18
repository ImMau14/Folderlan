// Simple reusable loading component that shows a spinner and message.

import { useI18n } from "@contexts/I18nContext"
import clsx from "clsx"

export interface LoadingPageProps {
  message?: string
  className?: string
}

export const LoadingPage = ({ message, className }: LoadingPageProps) => {
  const { t } = useI18n()
  const resolvedMessage = message ?? t("loading.default")
  return (
    <div
      role="status"
      aria-live="polite"
      className={clsx(
        "h-full w-full bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100",
        className ?? ""
      )}
    >
      <div className="flex h-dvh items-center justify-center gap-2">
        <div
          className="h-5 w-5 animate-spin rounded-full border-4 border-gray-300 border-t-gray-700"
          aria-hidden
        />
        <span className="font-body text-sm">{resolvedMessage}</span>
      </div>
    </div>
  )
}

export default LoadingPage
