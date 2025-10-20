// Simple reusable loading component that shows a spinner and message.

import React from "react"

export interface LoadingProps {
  message?: string
  className?: string
}

export const Loading: React.FC<LoadingProps> = ({ message = "Loading...", className }) => {
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
      <span className="font-body text-sm">{message}</span>
    </div>
  )
}

export default Loading
