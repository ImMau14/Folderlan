/**
 * Guard for the /setup route. Redirects away if the database already exists
 * or if the user is already authenticated.
 */

import { Navigate } from "react-router-dom"
import { useDatabase } from "@database/context/DatabaseContext"
import { useAuth } from "@auth/context/AuthContext"

export function SetupGuard({ children }: { children: React.ReactNode }) {
  const { dbExists } = useDatabase()
  const { isAuthenticated } = useAuth()

  if (dbExists) {
    return <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
  }
  return <>{children}</>
}
