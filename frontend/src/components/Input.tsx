// Reusable input component with consistent styling and native prop passthrough

import React from "react"

// Input component properties
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  title: string
}

// Main input component implementation
export const Input = React.forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  const { title, className, id, name, ...inputProps } = props
  const resolvedId = id ?? `input-${Math.random().toString(36).slice(2, 9)}`

  return (
    <label htmlFor={resolvedId} className="flex w-full flex-col items-start gap-2">
      <span className="font-body text-sm font-medium text-gray-900 dark:text-slate-100">{title}</span>
      <input
        ref={ref}
        id={resolvedId}
        name={name ?? resolvedId}
        className={[
          "block w-full rounded-md border-2 border-gray-300 hover:border-green-500 bg-gray-50 px-3 py-2 placeholder-gray-400 text-sm text-gray-900 font-body leading-5 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors duration-150 dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-100 dark:placeholder-slate-400",
          className ?? "",
        ].join(" ")}
        {...inputProps}
      />
    </label>
  )
})

Input.displayName = "Input"
