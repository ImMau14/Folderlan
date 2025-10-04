// Reusable button component with consistent styling and color variants

import type { ReactNode } from "react"
import React from "react"

// Button component properties
interface ButtonProps {
  children: ReactNode
  color: "green"
  type: string
  ref?: React.MutableRefObject<HTMLButtonElement | null>
  className?: string
  disabled?: boolean
}

// Color-specific style definitions
const styles = {
  green: {
    bg: "bg-green-600 hover:bg-green-500 active:bg-green-400",
    border: "border-green-600  hover:border-green-500 active:bg-green-400",
  },
}

// Main button component implementation
export const Button = ({ children, color, type = "", ref, className, disabled }: ButtonProps) => {
  const s = styles[color]
  return (
    <button
      className={`
        flex items-center justify-center rounded-lg ${className}
        border-2 px-4 py-2 font-body text-sm font-bold text-white
        ${s.bg} ${s.border} duration-100
        focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500
      `}
      type={type}
      ref={ref}
      disabled={disabled}
    >
      {children}
    </button>
  )
}
