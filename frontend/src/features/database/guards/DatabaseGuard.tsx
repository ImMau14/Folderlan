// Guard that checks whether the database exists and redirects or allows routes accordingly.

import { type ReactNode } from "react"
import { Navigate, useLocation, matchRoutes, type RouteObject } from "react-router-dom"

import LoadingPage from "@shared/pages/LoadingPage"
import NotFoundPage from "@shared/pages/NotFoundPage"
import { useI18n } from "@i18n/context/I18nContext"
import { useDatabase } from "@database/context/DatabaseContext"
import { useAuth } from "@auth/context/AuthContext"

interface RouteHandle {
  requiresAuth?: boolean
  requiresDb?: boolean
  public?: boolean
  isRoot?: boolean
}

// Use a type alias to extend the RouteObject type
type GuardRoute = RouteObject & {
  handle?: RouteHandle
}

interface Props {
  children?: ReactNode
  routes: GuardRoute[]
}

export const DatabaseGuard = ({ children, routes }: Props) => {
  const location = useLocation()
  const { dbExists, checked } = useDatabase()
  const { isAuthenticated } = useAuth()
  const { t } = useI18n()

  // While checking DB existence, show loading UI
  if (!checked) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <LoadingPage message={t("loading.checkingDatabase") ?? undefined} />
      </div>
    )
  }

  // Use matchRoutes against the provided routes metadata to know if the path exists
  const matches = matchRoutes(routes, location)

  // If no route matches:
  // - If DB doesn't exist -> force /setup
  // - Else -> show NotFoundPage (do NOT redirect to /login)
  if (!matches || matches.length === 0) {
    if (!dbExists) return <Navigate to="/setup" replace />
    return <NotFoundPage />
  }

  // Pick the most specific matched route and its handle metadata
  const matchedRoute = matches[matches.length - 1].route as GuardRoute
  const handle = matchedRoute.handle ?? {}

  // Root path behavior: if user hits '/', decide destination based on DB+auth
  if (location.pathname === "/") {
    if (!dbExists) return <Navigate to="/setup" replace />
    return <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
  }

  // If DB does not exist -> only allow public routes (e.g., /setup)
  if (!dbExists) {
    if (location.pathname === "/setup") {
      return <>{children}</>
    }
    return <Navigate to="/setup" replace />
  }

  // If DB exists but user navigated to /setup -> redirect away
  if (dbExists && location.pathname === "/setup") {
    return <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
  }

  // If route requires auth and user is not authenticated -> redirect to login
  const routeRequiresAuth = Boolean(handle.requiresAuth)
  if (routeRequiresAuth && !isAuthenticated && dbExists) {
    return <Navigate to="/login" replace />
  }

  // If route is /login but user is already authenticated -> dashboard
  if (location.pathname === "/login" && isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  // Passed all checks -> render children (the <Routes> tree)
  return <>{children}</>
}
