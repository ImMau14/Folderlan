/**
 * Top bar for the dashboard.
 * Shows current page title on the left, and a glassmorphic avatar with
 * a dropdown menu containing account info, theme toggle, and logout.
 */

import { useState, useCallback, useRef, useEffect, useMemo, type FC } from "react"
import { useLocation } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import { FiLogOut, FiMoon } from "react-icons/fi"
import { FaGear } from "react-icons/fa6"

import { useAuth } from "@auth/context/AuthContext"
import { useTheme } from "@theme/context/ThemeContext"
import { useI18n } from "@i18n/context/I18nContext"

const PAGE_TITLE_KEYS: Record<string, string> = {
  upload: "topbar.pageTitles.upload",
  download: "topbar.pageTitles.download",
  config: "topbar.pageTitles.config",
  users: "topbar.pageTitles.users",
}

export const TopBar: FC = () => {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const { t } = useI18n()
  const location = useLocation()
  const isDark = theme === "dark"

  const [openDropdown, setOpenDropdown] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const dropdownRef = useRef<HTMLDivElement | null>(null)
  const avatarRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        avatarRef.current &&
        !avatarRef.current.contains(e.target as Node)
      ) {
        setOpenDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleToggleTheme = useCallback(() => {
    setTheme(isDark ? "light" : "dark")
  }, [isDark, setTheme])

  const handleLogout = useCallback(async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      await logout()
    } catch {
      // AuthContext handles cleanup
    } finally {
      setIsLoggingOut(false)
      setOpenDropdown(false)
    }
  }, [isLoggingOut, logout])

  const pageTitle = useMemo(() => {
    const segment = location.pathname.split("/").pop() || ""
    const key = PAGE_TITLE_KEYS[segment]
    return key ? t(key) : t("topbar.pageTitles.dashboard")
  }, [location.pathname, t])

  const initials = user?.username
    ? user.username
        .split(" ")
        .map((word) => word[0])
        .join("")
        .toUpperCase()
    : "?"

  return (
    <div className="flex items-center justify-between px-6 py-5">
      <div className="flex items-center gap-4">
        <h1 className="font-heading text-2xl font-extrabold tracking-tight text-ui-text">
          {pageTitle}
        </h1>
      </div>

      <div className="relative flex items-center gap-3">
        <button
          ref={avatarRef}
          onClick={() => setOpenDropdown((prev) => !prev)}
          className="flex h-10 w-10 select-none items-center justify-center rounded-full bg-ui-primary font-body text-sm font-bold text-white shadow-md transition-all duration-200 hover:scale-105 hover:bg-ui-primary-hover active:scale-95 active:bg-ui-primary-active"
          aria-label={t("topbar.account")}
        >
          {initials}
        </button>

        <AnimatePresence>
          {openDropdown && (
            <motion.div
              ref={dropdownRef}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.18 }}
              className="glass absolute right-0 top-14 z-50 w-64 overflow-hidden rounded-2xl p-2 text-sm font-medium"
            >
              <div className="flex flex-col gap-0.5 px-3 py-2.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-ui-text-muted">
                  {t("topbar.account")}
                </span>
                <span className="truncate text-sm font-semibold text-ui-text">
                  {user?.username ?? t("topbar.unknown")}
                </span>
                <span className="text-xs font-medium capitalize text-ui-text-muted">
                  {user?.role ?? "visitor"}
                </span>
              </div>

              <div className="mx-2 my-1 h-px bg-ui-border" />

              <div className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-ui-text transition-colors hover:bg-ui-front">
                <div className="flex items-center gap-2.5">
                  <FiMoon className="h-4 w-4 text-ui-text-muted" />
                  <span className="font-medium">{t("topbar.darkMode")}</span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleTheme}
                  className={`focus:ring-ui-primary/20 relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 ${
                    isDark ? "bg-ui-primary" : "bg-ui-border"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      isDark ? "translate-x-5" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              <div className="mx-2 my-1 h-px bg-ui-border" />

              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex w-full flex-row items-center gap-2.5 rounded-xl px-3 py-2.5 text-left font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-75 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                <motion.div className="flex w-full flex-row items-center gap-2.5" layout>
                  {isLoggingOut ? (
                    <>
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{ type: "spring", stiffness: 900, damping: 25 }}
                      >
                        <FaGear className="h-4 w-4 animate-spin" />
                      </motion.div>
                      <span>{t("topbar.loggingOut")}</span>
                    </>
                  ) : (
                    <>
                      <FiLogOut className="h-4 w-4" />
                      <span>{t("topbar.logOut")}</span>
                    </>
                  )}
                </motion.div>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default TopBar
