// Route wrapper that ensures a valid auth token before rendering children.

import React from "react"
import { Navigate } from "react-router-dom"
import { isTokenValid } from "@utils/auth"

interface ProtectedRouteProps {
  children: React.ReactNode
}

// Protects a route by checking token validity.
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  if (!isTokenValid()) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}
