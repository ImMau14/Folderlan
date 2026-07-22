/**
 * Route guard that redirects unauthenticated users to /login.
 * If database does not exist, redirects to /setup regardless of auth state.
 */

import { Navigate } from "react-router-dom"
import { useAuth } from "@auth/context/AuthContext"
import { useDatabase } from "@database/context/DatabaseContext"

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  const { dbExists } = useDatabase()
  if (!dbExists) return <Navigate to="/setup" replace />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}
