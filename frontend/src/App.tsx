// Main application routing configuration with protected routes and authentication checks

import { Routes, Route, Navigate } from "react-router-dom"
import { LoginPage } from "@pages/LoginPage"
import { NotFoundPage } from "@pages/NotFoundPage"
import { isTokenValid } from "@utils/auth"

// Component to protect routes by checking authentication token validity
const ProtectedRoute = ({ children }) => {
  if (!isTokenValid()) {
    return <Navigate to="/login" replace />
  }
  return children
}

// Main App component defining all routes
export const App = () => {
  return (
    <Routes>
      {/* Root path redirects to dashboard if authenticated, otherwise to login */}
      <Route
        path="/"
        element={
          isTokenValid() ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
        }
      />

      {/* Login route redirects to dashboard if user is already authenticated */}
      <Route
        path="/login"
        element={isTokenValid() ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />

      {/* Protected dashboard route - requires valid authentication */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <p>Dashboard not yet</p>
          </ProtectedRoute>
        }
      />

      {/* Catch-all route for undefined paths */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
