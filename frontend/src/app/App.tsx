// Main application routing configuration with DatabaseGuard and protected routes.

import { useMemo, type FC } from "react"
import { Routes, Route } from "react-router-dom"

import NotFoundPage from "@shared/pages/NotFoundPage"
import LoginPage from "@auth/pages/LoginPage"
import SetupPage from "@setup"
import DashboardPage from "@dashboard"

import { useTheme } from "@theme/context/ThemeContext"

import { DatabaseGuard } from "@database/guards/DatabaseGuard"

import clsx from "clsx"

export const App: FC = () => {
  const { theme } = useTheme()

  // eslint-disable-next-line tailwindcss/no-custom-classname
  const classes = useMemo(() => clsx("h-full w-full", theme === "dark" && "dark"), [theme])

  // Single source of route metadata used by DatabaseGuard
  const routesConfig = [
    { path: "/", handle: { isRoot: true } },
    { path: "/login", handle: { public: true } },
    { path: "/setup", handle: { public: true } },
    { path: "/dashboard", handle: { requiresAuth: true, requiresDb: true } },
    { path: "*", handle: { public: true } },
  ]

  return (
    <div className={classes}>
      <DatabaseGuard routes={routesConfig}>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/setup" element={<SetupPage />} />

          {/* Protected routes */}
          <Route path="/dashboard/*" element={<DashboardPage />} />

          {/* Catch-all NotFound */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </DatabaseGuard>
    </div>
  )
}

export default App
