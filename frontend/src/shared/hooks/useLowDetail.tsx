// React context that manages low-detail mode (disables blur for performance).
// Persisted in localStorage, configurable from ConfigPage only.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

interface LowDetailContextValue {
  lowDetail: boolean
  setLowDetail: (value: boolean) => void
  toggleLowDetail: () => void
}

const STORAGE_KEY = "folderlan:lowDetail"

const getInitialLowDetail = (): boolean => {
  if (typeof window === "undefined") return false
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === "true"
  } catch {
    return false
  }
}

const LowDetailContext = createContext<LowDetailContextValue | undefined>(undefined)

interface LowDetailProviderProps {
  children: ReactNode
}

export const LowDetailProvider: React.FC<LowDetailProviderProps> = ({ children }) => {
  const [lowDetail, setLowDetailState] = useState<boolean>(getInitialLowDetail)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(lowDetail))
    } catch {
      // silent
    }
  }, [lowDetail])

  const setLowDetail = useCallback((value: boolean) => {
    setLowDetailState(value)
  }, [])

  const toggleLowDetail = useCallback(() => {
    setLowDetailState((prev) => !prev)
  }, [])

  const value = useMemo<LowDetailContextValue>(
    () => ({ lowDetail, setLowDetail, toggleLowDetail }),
    [lowDetail, setLowDetail, toggleLowDetail]
  )

  return <LowDetailContext.Provider value={value}>{children}</LowDetailContext.Provider>
}

export const useLowDetail = (): LowDetailContextValue => {
  const context = useContext(LowDetailContext)
  if (!context) {
    throw new Error("useLowDetail must be used within a LowDetailProvider")
  }
  return context
}
