import { type ReactNode, type ButtonHTMLAttributes, forwardRef, useMemo } from "react"
import clsx from "clsx"

type ColorsType = "primary" | "secondary" | "bordered"

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  color?: ColorsType
}

const baseClasses =
  "flex w-full flex-row items-center justify-center gap-2 select-none rounded-full border-2 px-4 py-2 font-body text-sm font-semibold transition-colors duration-200 ease-in-out shadow-sm disabled:cursor-not-allowed disabled:opacity-50"

const styles: Record<ColorsType, { classes: string }> = {
  primary: {
    classes:
      "bg-ui-primary text-ui-highlight border-ui-primary hover:border-ui-primary-hover hover:bg-ui-primary-hover active:border-ui-primary-active active:bg-ui-primary-active dark:text-ui-base",
  },
  secondary: {
    classes:
      "bg-ui-secondary text-ui-highlight border-ui-secondary hover:border-ui-secondary-hover hover:bg-ui-secondary-hover active:border-ui-secondary-active active:bg-ui-secondary-active dark:text-ui-base",
  },
  bordered: {
    classes:
      "bg-ui-front border-ui-border text-ui-text hover:border-ui-primary active:border-ui-primary-hover hover:text-ui-primary active:text-ui-primary-hover",
  },
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => {
  const { children, color = "primary", className, ...rest } = props

  const classes = useMemo(
    () => clsx(baseClasses, styles[color].classes, className),
    [color, className]
  )

  return (
    <button ref={ref} className={classes} {...rest}>
      {children}
    </button>
  )
})

Button.displayName = "Button"
export default Button
