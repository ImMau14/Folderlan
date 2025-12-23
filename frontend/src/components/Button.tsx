// Reusable button component with consistent styling and color variants

import { type ReactNode, type ButtonHTMLAttributes, forwardRef } from 'react'

// Button component properties
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  color?: 'green'
}

// Color-specific style definitions
const styles: Record<'green', { bg: string; border: string }> = {
  green: {
    bg: 'bg-green-600 hover:bg-green-500 active:bg-green-400',
    border: 'border-green-600 hover:border-green-500 active:border-green-400',
  },
}

// Main button component implementation
export const Button = forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => {
  const { children, color = 'green', className, ...rest } = props
  const s = styles[color]

  return (
    <button
      ref={ref}
      className={[
        'flex items-center justify-center rounded-lg border-2 px-4 py-2 font-body text-sm font-bold text-white duration-100',
        s.bg,
        s.border,
        'focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500',
        className ?? '',
      ].join(' ')}
      {...rest}
    >
      {children}
    </button>
  )
})

Button.displayName = 'Button'
export default Button
