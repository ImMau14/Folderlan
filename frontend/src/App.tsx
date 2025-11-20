// Main application routing configuration with DatabaseGuard and protected routes.

import React from "react"
import { Routes, Route } from "react-router-dom"
import { NotFoundPage } from "@pages/NotFoundPage"
import { SetupPage } from "@pages/SetupPage"

import { ProtectedRoute } from "@routes/ProtectedRoute"
import { RootRedirect } from "@routes/RootRedirect"
import { LoginRouteElement } from "@routes/LoginRouteElement"
import { DatabaseGuard } from "@guards/DatabaseGuard"
import { GlobalControlsOverlay } from "@components/GlobalControlsOverlay"

export const App: React.FC = () => {
  return (
    <div className="relative min-h-screen">
      <DatabaseGuard>
        <Routes>
          {/* Root path redirects to dashboard if authenticated, otherwise to login */}
          <Route path="/" element={<RootRedirect />} />

          {/* Login route redirects to dashboard if user is already authenticated */}
          <Route path="/login" element={<LoginRouteElement />} />

          {/* Setup route (render the page that initializes DB) */}
          <Route path="/setup" element={<SetupPage />} />

          {/* Protected dashboard route - requires valid authentication */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <div className="p-6 text-center text-gray-700">Dashboard not yet</div>
              </ProtectedRoute>
            }
          />

          {/* Catch-all route for undefined paths */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </DatabaseGuard>
      <GlobalControlsOverlay />
    </div>
  )
}

export default App
