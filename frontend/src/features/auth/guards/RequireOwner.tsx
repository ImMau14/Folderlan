/**
 * Route guard that only allows users with the "owner" role.
 * Visitors (or unauthenticated users) are redirected to /dashboard.
 */

import { Navigate } from "react-router-dom"
import { useAuth } from "@auth/context/AuthContext"

export function RequireOwner({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth()
  if (!isAuthenticated || user?.role !== "owner") {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}
