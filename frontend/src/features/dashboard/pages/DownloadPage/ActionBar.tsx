/**
 * ActionBar — floating bottom bar with bulk actions for the file selection.
 *
 * Appears (spring animation) as soon as at least one file is selected and
 * offers: download all, open permissions, delete all and clear selection.
 * While visible it hides the bottom navigation so the two never overlap.
 */
import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { FaDownload, FaGlobe, FaTrash, FaXmark } from "react-icons/fa6"

import { useI18n } from "@i18n/context/I18nContext"
import { useBottomNav } from "../../components/BottomNavContext"

interface ActionBarProps {
  selectedCount: number
  /** True when every selected file can be managed (collaborator/owner access). */
  canManage: boolean
  onDownload: () => void
  onVisibility: () => void
  onDelete: () => void
  onClear: () => void
}

export default function ActionBar({
  selectedCount,
  canManage,
  onDownload,
  onVisibility,
  onDelete,
  onClear,
}: ActionBarProps) {
  const { t } = useI18n()
  const { setIsHidden } = useBottomNav()

  // Mobile renders the bar full-width at the screen bottom; sm+ renders the
  // centered floating pill. Kept in sync with the sm: breakpoint (640px).
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640)

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 639px)")
    const handleChange = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener("change", handleChange)
    return () => mql.removeEventListener("change", handleChange)
  }, [])

  // Hide the bottom nav while the bar is shown, restore it afterwards.
  useEffect(() => {
    setIsHidden(selectedCount > 0)
    return () => setIsHidden(false)
  }, [selectedCount, setIsHidden])

  return (
    <AnimatePresence>
      {/* Only rendered when at least one file is selected */}
      {selectedCount > 0 && (
        <motion.div
          data-action-bar=""
          initial={{ y: 150, opacity: 0, x: isMobile ? 0 : "-50%" }}
          animate={{ y: 0, opacity: 1, x: isMobile ? 0 : "-50%" }}
          exit={{ y: 150, opacity: 0, x: isMobile ? 0 : "-50%" }}
          transition={{ type: "spring", damping: 20, stiffness: 300, mass: 1 }}
          className="glass-smoked fixed inset-x-2 bottom-2 z-50 flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 backdrop-blur-lg sm:inset-x-auto sm:bottom-6 sm:left-1/2 sm:max-w-[calc(100vw-1.5rem)] sm:gap-6 sm:rounded-full sm:px-6 sm:py-4"
        >
          {/* Selected count badge */}
          <div className="flex shrink-0 items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ui-primary font-heading text-sm font-bold text-white">
              {selectedCount}
            </span>
            <span className="hidden font-heading text-sm font-medium text-ui-text sm:inline">
              {t("download.actionBar.selected")}
            </span>
          </div>

          {/* Bulk action buttons: stretch to fill the bar on mobile, content-sized on sm+ */}
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
            <button
              onClick={onDownload}
              className="flex min-w-0 flex-1 items-center justify-center gap-2 truncate rounded-full bg-ui-primary px-2.5 py-2 font-body text-sm font-semibold text-ui-highlight transition-all hover:bg-ui-primary-hover sm:flex-none sm:px-4 dark:text-ui-base"
            >
              <FaDownload className="h-4 w-4 shrink-0" />
              <span className="truncate">{t("download.actions.download")}</span>
            </button>

            {/* Permissions + delete only shown when the caller can actually manage
                every selected file; otherwise they would fail on the backend. */}
            {canManage && (
              <>
                <button
                  onClick={onVisibility}
                  className="flex min-w-0 flex-1 items-center justify-center gap-2 truncate rounded-full border-2 border-ui-border bg-ui-front px-2.5 py-2 font-body text-sm font-semibold text-ui-text transition-all hover:border-ui-primary sm:flex-none sm:px-4"
                >
                  <FaGlobe className="h-4 w-4 shrink-0" />
                  <span className="truncate">{t("download.actions.permissions")}</span>
                </button>

                <button
                  onClick={onDelete}
                  className="flex min-w-0 flex-1 items-center justify-center gap-2 truncate rounded-full bg-ui-danger px-2.5 py-2 font-body text-sm font-semibold text-white transition-all hover:bg-ui-danger-hover sm:flex-none sm:px-4 dark:text-ui-base"
                >
                  <FaTrash className="h-4 w-4 shrink-0" />
                  <span className="truncate">{t("download.actions.delete")}</span>
                </button>
              </>
            )}

            <div className="mx-1 h-6 w-[1px] bg-ui-border"></div>

            {/* Clear selection */}
            <button
              onClick={onClear}
              className="rounded-full p-2 text-ui-text-muted transition-colors hover:bg-ui-border/50 hover:text-ui-text"
              title={t("download.actionBar.clear")}
            >
              <FaXmark className="h-5 w-5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
