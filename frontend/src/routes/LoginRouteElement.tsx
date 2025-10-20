// Route element for /login that renders login page or redirects when already authenticated.

import React from "react"
import { Navigate } from "react-router-dom"
import { isTokenValid } from "@utils/auth"
import { LoginPage } from "@pages/LoginPage"

// If already authenticated -> redirect to dashboard, otherwise show LoginPage.
export const LoginRouteElement: React.FC = () => {
  return isTokenValid() ? <Navigate to="/dashboard" replace /> : <LoginPage />
}
