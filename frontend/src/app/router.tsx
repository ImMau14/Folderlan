import { type ReactNode } from "react"
import { createBrowserRouter, Navigate } from "react-router-dom"
import { useAuth } from "@auth/context/AuthContext"
import { useDatabase } from "@database/context/DatabaseContext"
import { RequireAuth } from "@auth/guards/RequireAuth"
import { RequireOwner } from "@auth/guards/RequireOwner"
import { SetupGuard } from "@database/guards/SetupGuard"
import DashboardLayout from "@dashboard" // features/dashboard/index
import LoginPage from "@auth/pages/LoginPage"
import OwnerRecoverPage from "@auth/pages/OwnerRecoverPage"
import SetupPage from "@setup"
import NotFoundPage from "@shared/pages/NotFoundPage"
import UploadPage from "@dashboard/pages/UploadPage"
import DownloadPage from "@dashboard/pages/DownloadPage"
import UsersPage from "@dashboard/pages/UsersPage"
import ConfigPage from "@dashboard/pages/ConfigPage"

function RootRedirect() {
  const { dbExists } = useDatabase()
  const { isAuthenticated } = useAuth()
  if (!dbExists) return <Navigate to="/setup" replace />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Navigate to="/dashboard" replace />
}

function RequireDb({ children }: { children: ReactNode }) {
  const { dbExists } = useDatabase()
  if (!dbExists) return <Navigate to="/setup" replace />
  return <>{children}</>
}

export const router = createBrowserRouter([
  { path: "/", element: <RootRedirect /> },
  {
    path: "/login",
    element: (
      <RequireDb>
        <LoginPage />
      </RequireDb>
    ),
  },
  {
    path: "/owner-recover",
    element: (
      <RequireDb>
        <OwnerRecoverPage />
      </RequireDb>
    ),
  },
  {
    path: "/setup",
    element: (
      <SetupGuard>
        <SetupPage />
      </SetupGuard>
    ),
  },
  {
    path: "/dashboard",
    element: (
      <RequireAuth>
        <DashboardLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard/upload" replace /> },
      { path: "upload", element: <UploadPage /> },
      { path: "download", element: <DownloadPage /> },
      { path: "config", element: <ConfigPage /> },
      {
        path: "users",
        element: (
          <RequireOwner>
            <UsersPage />
          </RequireOwner>
        ),
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
])
