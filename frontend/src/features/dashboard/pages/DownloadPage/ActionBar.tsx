/**
 * ActionBar — floating bottom bar with bulk actions for the file selection.
 *
 * Appears (spring animation) as soon as at least one file is selected and
 * offers: download all, open permissions, delete all and clear selection.
 * While visible it hides the bottom navigation so the two never overlap.
 */
import { useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { FaDownload, FaGlobe, FaTrash, FaXmark } from "react-icons/fa6"

import { useI18n } from "@i18n/context/I18nContext"
import { useBottomNav } from "../../components/BottomNavContext"

interface ActionBarProps {
  selectedCount: number
  onDownload: () => void
  onVisibility: () => void
  onDelete: () => void
  onClear: () => void
}

export default function ActionBar({
  selectedCount,
  onDownload,
  onVisibility,
  onDelete,
  onClear,
}: ActionBarProps) {
  const { t } = useI18n()
  const { setIsHidden } = useBottomNav()

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
          initial={{ y: 150, opacity: 0, x: "-50%" }}
          animate={{ y: 0, opacity: 1, x: "-50%" }}
          exit={{ y: 150, opacity: 0, x: "-50%" }}
          transition={{ type: "spring", damping: 20, stiffness: 300, mass: 1 }}
          className="glass-smoked fixed bottom-6 left-1/2 z-50 flex max-w-[calc(100vw-1.5rem)] items-center justify-between gap-4 rounded-full px-4 py-3 backdrop-blur-lg sm:gap-6 sm:px-6 sm:py-4"
        >
          {/* Selected count badge */}
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ui-primary font-heading text-sm font-bold text-white">
              {selectedCount}
            </span>
            <span className="hidden font-heading text-sm font-medium text-ui-text sm:inline">
              {t("download.actionBar.selected")}
            </span>
          </div>

          {/* Bulk action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={onDownload}
              className="flex items-center gap-2 rounded-full bg-ui-primary px-4 py-2 font-body text-sm font-semibold text-ui-highlight transition-all hover:bg-ui-primary-hover dark:text-ui-base"
            >
              <FaDownload className="h-4 w-4" />
              <span className="hidden sm:inline">{t("download.actions.download")}</span>
            </button>

            <button
              onClick={onVisibility}
              className="flex items-center gap-2 rounded-full border-2 border-ui-border bg-ui-front px-4 py-2 font-body text-sm font-semibold text-ui-text transition-all hover:border-ui-primary"
            >
              <FaGlobe className="h-4 w-4" />
              <span className="hidden sm:inline">{t("download.actions.permissions")}</span>
            </button>

            <button
              onClick={onDelete}
              className="flex items-center gap-2 rounded-full bg-ui-danger px-4 py-2 font-body text-sm font-semibold text-white transition-all hover:bg-ui-danger-hover dark:text-ui-base"
            >
              <FaTrash className="h-4 w-4" />
              <span className="hidden sm:inline">{t("download.actions.delete")}</span>
            </button>

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
