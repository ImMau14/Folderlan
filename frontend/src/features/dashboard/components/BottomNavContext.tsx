import { createContext, useContext, useState, type ReactNode } from "react"

interface BottomNavContextType {
  isHidden: boolean
  setIsHidden: (hidden: boolean) => void
}

const BottomNavContext = createContext<BottomNavContextType>({
  isHidden: false,
  setIsHidden: () => {},
})

export function BottomNavProvider({ children }: { children: ReactNode }) {
  const [isHidden, setIsHidden] = useState(false)

  return (
    <BottomNavContext.Provider value={{ isHidden, setIsHidden }}>
      {children}
    </BottomNavContext.Provider>
  )
}

export function useBottomNav() {
  return useContext(BottomNavContext)
}
