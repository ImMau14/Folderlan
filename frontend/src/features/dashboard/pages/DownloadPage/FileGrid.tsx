/**
 * FileGrid — renders the file list as a responsive card grid.
 *
 * Handles the three possible states of the list:
 * - initial loading (spinner),
 * - empty (friendly empty state),
 * - populated (one FileCard per file, with enter/exit animations).
 */
import { AnimatePresence, motion } from "framer-motion"
import { FaMagnifyingGlass } from "react-icons/fa6"

import { useI18n } from "@i18n/context/I18nContext"
import type { FileItem } from "@shared/utils/ApiClient/types"
import FileCard from "./FileCard"

interface FileGridProps {
  files: FileItem[]
  loading: boolean
  selectedIds: Set<number>
  onSelect: (file: FileItem) => void
  onDoubleClick: (file: FileItem) => void
  onToggleVisibility: (file: FileItem) => void
}

export default function FileGrid({
  files,
  loading,
  selectedIds,
  onSelect,
  onDoubleClick,
  onToggleVisibility,
}: FileGridProps) {
  const { t } = useI18n()

  // Initial load: there is nothing to show yet, so display a spinner.
  if (loading && files.length === 0) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 py-16">
        <span className="h-10 w-10 animate-spin rounded-full border-[3px] border-ui-border border-t-ui-primary shadow-ui" />
        <p className="font-heading text-sm font-medium text-ui-text-muted">
          {t("download.table.loading")}
        </p>
      </div>
    )
  }

  // No results: show an empty state instead of an empty grid.
  if (files.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mx-auto mt-10 flex min-h-[300px] w-full max-w-md flex-col items-center justify-center gap-4 rounded-3xl border border-ui-border bg-ui-base py-16 text-center shadow-ui"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-ui-border bg-ui-front shadow-ui">
          <FaMagnifyingGlass className="text-2xl text-ui-primary" />
        </div>
        <div>
          <p className="font-heading text-lg font-bold text-ui-text">
            {t("download.table.noFiles")}
          </p>
          <p className="mt-1 font-body text-sm text-ui-text-muted">
            {t("download.table.noFilesDesc")}
          </p>
        </div>
      </motion.div>
    )
  }

  return (
    // Responsive grid; AnimatePresence keeps cards animating in/out smoothly.
    <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
      <AnimatePresence mode="popLayout">
        {files.map((file, idx) => (
          <FileCard
            key={file.id}
            file={file}
            isSelected={selectedIds.has(file.id)}
            onSelect={onSelect}
            onDoubleClick={onDoubleClick}
            onToggleVisibility={onToggleVisibility}
            index={idx}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}
