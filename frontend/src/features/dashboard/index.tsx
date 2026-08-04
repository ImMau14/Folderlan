import { Outlet } from "react-router-dom"
import { motion } from "framer-motion"
import { useState, useEffect, type FC } from "react"

import { useAuth } from "@auth/context/AuthContext"

import Menu from "./components/Menu"
import TopBar from "./components/TopBar"
import BottomNav from "./components/BottomNav"
import { BottomNavProvider, useBottomNav } from "./components/BottomNavContext"

const MOBILE_BREAKPOINT = 768

function DashboardContent() {
  const { user } = useAuth()
  const isOwner = user?.role === "owner"
  const { isHidden } = useBottomNav()

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < MOBILE_BREAKPOINT)

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const handleChange = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener("change", handleChange)
    return () => mql.removeEventListener("change", handleChange)
  }, [])

  // Desktop layout
  if (!isMobile) {
    return (
      <motion.div
        className="grid h-full w-full grid-cols-[250px_1fr] bg-ui-back"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Menu basePath="/dashboard" isOwner={isOwner} />
        <main className="grid max-h-full grid-rows-[auto_1fr] overflow-hidden">
          <TopBar />
          <div className="h-full w-full overflow-hidden">
            <Outlet />
          </div>
        </main>
      </motion.div>
    )
  }

  // Mobile layout
  return (
    <motion.div
      className="flex h-full w-full flex-col bg-ui-back"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <TopBar />
      <main className="flex-1 overflow-auto pb-20 scrollbar scrollbar-rounded scrollbar-thin scrollbar-thumb-ui-text-muted">
        <div className="min-h-full w-full">
          <Outlet />
        </div>
      </main>
      {!isHidden && <BottomNav isOwner={isOwner} />}
    </motion.div>
  )
}

export const DashboardLayout: FC = () => {
  return (
    <BottomNavProvider>
      <DashboardContent />
    </BottomNavProvider>
  )
}

export default DashboardLayout
