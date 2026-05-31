/**
 * Provides a React Context for managing database existence state.
 * This provider blocks rendering of children until the initial database check completes,
 * ensuring downstream consumers (router, guards) work with resolved state.
 */

import React, { createContext, useContext, useEffect, useState, type FC, useCallback } from "react"
import { ApiClient } from "@shared/utils/ApiClient"
import { useToast } from "@toast/context/ToastContext"
import { useI18n } from "@i18n/context/I18nContext"
import LoadingPage from "@shared/pages/LoadingPage"

type DbContextType = {
  /** Whether the backend database has been initialised */
  dbExists: boolean
  /** Whether the initial check has completed */
  checked: boolean
  /** Whether a manual refresh is in progress */
  isRefreshing: boolean
  /** Triggers a fresh check of the database status */
  refresh: () => Promise<void>
  /** Allows manual override of the database existence flag (e.g. after setup) */
  setDbExists: (v: boolean) => void
}

const DatabaseContext = createContext<DbContextType | undefined>(undefined)

/**
 * DatabaseProvider checks the backend database status on mount.
 * Children are not rendered until the check finishes, avoiding UI flickering
 * and making guards synchronous.
 */
export const DatabaseProvider: FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dbExists, setDbExists] = useState(false)
  const [checked, setChecked] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const { toast } = useToast()
  const { t } = useI18n()

  // Initial database check on mount
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

        if (mounted) {
          // exists may be at the root level (wrapper) or inside the nested data object
          const exists = res.data?.data?.exists ?? res.data?.exists ?? false
          setDbExists(exists)
        }
      } catch (e) {
        if (!mounted) return
        setDbExists(false)

        toast({
          type: "error",
          title: t("global.error"),
          description: e instanceof Error ? e.message : "-",
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

  // Manual refresh with loading state
  const refresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const apiClient = new ApiClient()
      const res = await apiClient.checkDb()

      if (!res.success) {
        console.error(res)
        throw new Error(t("databaseContext.refreshError"))
      }

      const exists = res.data?.data?.exists ?? res.data?.exists ?? false
      setDbExists(exists)
    } catch (e) {
      toast({
        type: "error",
        title: t("global.error"),
        description: e instanceof Error ? e.message : "-",
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

  // Block children until the initial check is complete
  if (!checked) {
    return <LoadingPage message={t("loading.checkingDatabase")} />
  }

  return <DatabaseContext.Provider value={value}>{children}</DatabaseContext.Provider>
}

/**
 * Custom hook to consume DatabaseContext.
 * Throws if used outside of a DatabaseProvider.
 */
export const useDatabase = () => {
  const ctx = useContext(DatabaseContext)
  if (!ctx) throw new Error("useDatabase must be used inside DatabaseProvider")
  return ctx
}
