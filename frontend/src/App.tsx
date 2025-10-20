// Main application routing configuration with protected routes and authentication checks

import { Routes, Route, Navigate, useLocation } from "react-router-dom"
import { useEffect, useState } from "react"
import { LoginPage } from "@pages/LoginPage"
import { NotFoundPage } from "@pages/NotFoundPage"
import { SetupPage } from "@pages/SetupPage"
import { isTokenValid } from "@utils/auth"
import { dbExist } from "@utils/dbExist"

// Component to protect routes by checking authentication token validity
const ProtectedRoute = ({ children }) => {
  if (!isTokenValid()) {
    return <Navigate to="/login" replace />
  }
  return children
}

// DatabaseGuard: Checks if database exists using async dbExist()
const DatabaseGuard = ({ children }) => {
  const location = useLocation()
  const [checked, setChecked] = useState(false)
  const [exists, setExists] = useState(false)

  useEffect(() => {
    let mounted = true
    const check = async () => {
      try {
        const r = await dbExist()
        if (!mounted) return
        setExists(Boolean(r))
      } catch (err) {
        // Treat errors as "db does not exist"
        console.log(err)
        if (!mounted) return
        setExists(false)
      } finally {
        if (mounted) setChecked(true)
      }
    }
    check()
    return () => {
      mounted = false
    }
  }, [])

  // While checking DB existence, don't render routes
  if (!checked) return null

  // DB does NOT exist
  if (!exists) {
    // Allow only /setup to be visited when DB is missing
    if (location.pathname === "/setup") {
      return children
    }
    // Otherwise redirect to /setup
    return <Navigate to="/setup" replace />
  }

  // DB exists
  // Prevent entering /setup when DB already exists -> redirect to dashboard/login
  if (exists && location.pathname === "/setup") {
    // if user authenticated, send to dashboard; else to login
    return <Navigate to={isTokenValid() ? "/dashboard" : "/login"} replace />
  }

  // DB exists and not on /setup -> normal routing
  return children
}

// Main App component defining all routes
export const App = () => {
  return (
    <DatabaseGuard>
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

        {/* Setup route (render the page that initializes DB) */}
        <Route path="/setup" element={<SetupPage />} />

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
    </DatabaseGuard>
  )
}
