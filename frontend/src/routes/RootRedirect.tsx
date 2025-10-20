// Component that redirects root path to dashboard or login based on auth.

import React from "react"
import { Navigate } from "react-router-dom"
import { isTokenValid } from "@utils/auth"

// Redirects "/" to "/dashboard" when authenticated, otherwise to "/login".
export const RootRedirect: React.FC = () => {
  return isTokenValid() ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
}
