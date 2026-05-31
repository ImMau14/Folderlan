import React, { useId } from "react"
import clsx from "clsx"
import Input from "@shared/components/Input"

export interface LabeledInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  title: string
}

export const LabeledInput = React.forwardRef<HTMLInputElement, LabeledInputProps>(
  ({ title, className, id, name, ...inputProps }, ref) => {
    const generatedId = useId()
    const inputId = id ?? generatedId

    const labelClasses = clsx("flex w-full flex-col items-start gap-1.5", className)

    const titleClasses = clsx("font-body text-sm font-medium text-ui-text-muted")

    return (
      <label htmlFor={inputId} className={labelClasses}>
        <span className={titleClasses}>{title}</span>
        <Input ref={ref} id={inputId} name={name ?? inputId} {...inputProps} />
      </label>
    )
  }
)

LabeledInput.displayName = "LabeledInput"
export default LabeledInput
