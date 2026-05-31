/**
 * Root application component.
 * Applies the theme class and renders the router via RouterProvider.
 */

import { useMemo, type FC } from "react"
import { RouterProvider } from "react-router-dom"
import { router } from "@app/router"
import { useTheme } from "@theme/context/ThemeContext"
import clsx from "clsx"

export const App: FC = () => {
  const { theme } = useTheme()
  const classes = useMemo(() => clsx("h-full w-full", theme === "dark" && "dark"), [theme])

  return (
    <div className={classes}>
      <RouterProvider router={router} />
    </div>
  )
}

export default App
