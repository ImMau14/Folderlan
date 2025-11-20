// Simple reusable loading component that shows a spinner and message.

import React from "react"
import { useI18n } from "@i18n/I18nProvider"

export interface LoadingProps {
  message?: string
  className?: string
}

export const Loading: React.FC<LoadingProps> = ({ message, className }) => {
  const { t } = useI18n()
  const resolvedMessage = message ?? t("loading.default")
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center justify-center gap-2 text-gray-700 ${className ?? ""}`}
    >
      <div
        className="h-5 w-5 animate-spin rounded-full border-4 border-gray-300 border-t-gray-700"
        aria-hidden
      />
      <span className="font-body text-sm">{resolvedMessage}</span>
    </div>
  )
}

export default Loading
