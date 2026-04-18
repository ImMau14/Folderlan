// Provides a React Context for managing database existence state and checking operations.

import React, { createContext, useContext, useEffect, useState, type FC, useCallback } from "react"
import { ApiClient } from "@utils/ApiClient"

import { useToast } from "@contexts/ToastContext"
import { useI18n } from "@contexts/I18nContext"

// Shape of the context value exposed to consumers
type DbContextType = {
  dbExists: boolean
  checked: boolean
  isRefreshing: boolean
  refresh: () => Promise<void>
  setDbExists: (v: boolean) => void
}

// Create context with undefined default to force provider usage check
const DatabaseContext = createContext<DbContextType | undefined>(undefined)

// DatabaseProvider checks database existence on mount and provides refresh capability
export const DatabaseProvider: FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dbExists, setDbExists] = useState(false)
  const [checked, setChecked] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const { toast } = useToast()
  const { t } = useI18n()

  // Check database existence on initial mount
  useEffect(() => {
    let mounted = true
    const run = async () => {
      try {
        if (!mounted) return

        const apiClient = new ApiClient()
        const res = await apiClient.checkDb()

        if (!res.success) {
          console.error(res)
          throw new Error(t("databaseContext.checkingError"))
        }

        setDbExists(res?.data?.exists ?? false)
      } catch (e) {
        if (!mounted) return
        setDbExists(false)

        toast({
          type: "error",
          title: t("global.error"),
          description: e instanceof Error ? e?.message : "-",
          duration: 3000,
        })
      } finally {
        if (mounted) setChecked(true)
      }
    }
    run()
    return () => {
      mounted = false
    }
  }, [toast, t])

  // Refresh database existence status with loading state
  const refresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const apiClient = new ApiClient()
      const res = await apiClient.checkDb()

      if (!res.success) {
        console.error(res)
        throw new Error(t("databaseContext.refreshError"))
      }

      setDbExists(res?.data?.exists ?? false)
    } catch (e) {
      toast({
        type: "error",
        title: t("global.error"),
        description: e instanceof Error ? e?.message : "-",
        duration: 3000,
      })
    } finally {
      setIsRefreshing(false)
    }
  }, [t, toast])

  const value: DbContextType = {
    dbExists,
    checked,
    isRefreshing,
    refresh,
    setDbExists,
  }

  return <DatabaseContext.Provider value={value}>{children}</DatabaseContext.Provider>
}

// Custom hook to consume DatabaseContext. Throws if used outside provider
export const useDatabase = () => {
  const ctx = useContext(DatabaseContext)
  if (!ctx) throw new Error("useDatabase must be used inside DatabaseProvider")
  return ctx
}
