// Guard that checks whether the database exists and redirects or allows routes accordingly.

import React, { useEffect, useState } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { dbExist } from "@utils/dbExist"
import { isTokenValid } from "@utils/auth"
import Loading from "@components/Loading"

interface DatabaseGuardProps {
  children: HTMLElement
}

// DatabaseGuard: Verifies DB existence using async dbExist().
export const DatabaseGuard: React.FC<DatabaseGuardProps> = ({ children }) => {
  const location = useLocation()
  const [checked, setChecked] = useState(false)
  const [exists, setExists] = useState(false)

  useEffect(() => {
    let mounted = true

    const check = async () => {
      try {
        const result = await dbExist()
        if (!mounted) return
        setExists(Boolean(result))
      } catch (err) {
        console.error("dbExist error:", err)
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

  // While checking DB existence, show loading UI
  if (!checked)
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loading message="Checking database..." />
      </div>
    )

  // DB does NOT exist -> allow only /setup
  if (!exists) {
    if (location.pathname === "/setup") return children
    return <Navigate to="/setup" replace />
  }

  // DB exists -> prevent entering /setup; redirect based on auth
  if (exists && location.pathname === "/setup") {
    return <Navigate to={isTokenValid() ? "/dashboard" : "/login"} replace />
  }

  // DB exists and not on /setup -> normal routing
  return children
}
