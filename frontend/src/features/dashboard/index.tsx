/**
 * Dashboard layout – responsive container with animated sub‑route transitions.
 * Desktop: sidebar + main content. Mobile: top bar + content + bottom nav.
 * This is the default export of the dashboard feature.
 */

import { Outlet, useLocation } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import { useState, useEffect, type FC } from "react"

import { useAuth } from "@auth/context/AuthContext"

import Menu from "./components/Menu"
import TopBar from "./components/TopBar"
import BottomNav from "./components/BottomNav"

const MOBILE_BREAKPOINT = 768

export const DashboardLayout: FC = () => {
  const { user } = useAuth()
  const isOwner = user?.role === "owner"
  const location = useLocation()

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
        <main className="grid grid-rows-[auto_1fr]">
          <TopBar />
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.15 }}
              className="h-full w-full overflow-auto"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
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
      <main className="flex-1 overflow-auto pb-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.15 }}
            className="h-full w-full"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      <BottomNav isOwner={isOwner} />
    </motion.div>
  )
}

export default DashboardLayout
