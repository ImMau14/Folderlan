/**
 * Route guard that redirects unauthenticated users to /login.
 */

import { Navigate } from "react-router-dom"
import { useAuth } from "@auth/context/AuthContext"

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}
