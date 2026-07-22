import React, { forwardRef, useId } from "react"
import clsx from "clsx"
import { BiSolidUpArrow } from "react-icons/bi"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, id, type, ...props }, ref) => {
    const generatedId = useId()
    const inputId = id ?? generatedId
    const inputRef = React.useRef<HTMLInputElement>(null)

    // Exposes the internal <input> ref to the parent
    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

    const isNumber = type === "number"

    const handleStepUp = () => inputRef.current?.stepUp()
    const handleStepDown = () => inputRef.current?.stepDown()

    const inputClasses = clsx(
      "block w-full rounded-full border-2 px-3 py-2 font-body text-sm leading-5 shadow-sm transition-colors duration-150",
      "border-ui-border bg-ui-front text-ui-text placeholder-ui-text-muted",
      "focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ui-primary",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className
    )

    const arrowButtonClasses = clsx(
      "text-xs transition-colors duration-200 ease-in-out",
      "text-ui-text/80 hover:text-ui-text-muted active:text-ui-highlight",
      "disabled:cursor-not-allowed disabled:opacity-50"
    )

    return (
      <div className="relative w-full">
        <input ref={inputRef} id={inputId} className={inputClasses} type={type} {...props} />
        {isNumber && (
          <div className="absolute right-3 top-1/2 flex -translate-y-1/2 flex-col gap-0.5 px-1 py-2">
            <button
              type="button"
              className={arrowButtonClasses}
              onClick={handleStepUp}
              disabled={props.disabled}
              aria-label="Increment"
            >
              <BiSolidUpArrow />
            </button>
            <button
              type="button"
              className={arrowButtonClasses}
              onClick={handleStepDown}
              disabled={props.disabled}
              aria-label="Decrement"
            >
              <BiSolidUpArrow className="rotate-180" />
            </button>
          </div>
        )}
      </div>
    )
  }
)

Input.displayName = "Input"
export default Input
