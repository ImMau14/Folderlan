import { motion } from "framer-motion"
import { FaChevronLeft, FaChevronRight } from "react-icons/fa"

import { useI18n } from "@i18n/context/I18nContext"

interface PaginationProps {
  total: number
  offset: number
  pageSize: number
  currentPage: number
  totalPages: number
  onPrevPage: () => void
  onNextPage: () => void
}

export default function Pagination({
  total,
  offset,
  pageSize,
  currentPage,
  totalPages,
  onPrevPage,
  onNextPage,
}: PaginationProps) {
  const { t } = useI18n()

  return (
    <div className="flex w-full items-center justify-between">
      <p className="font-body text-sm text-ui-text-muted">
        {t("download.pagination.showing", {
          start: offset + 1,
          end: Math.min(offset + pageSize, total),
          total,
        })}
      </p>
      <div className="flex items-center gap-2">
        <motion.button
          onClick={onPrevPage}
          disabled={offset === 0}
          whileTap={offset !== 0 ? { scale: 0.95 } : undefined}
          className="flex items-center gap-1 rounded-full border-2 border-ui-border px-3 py-1.5 font-body text-sm font-semibold text-ui-text transition-all hover:border-ui-primary disabled:opacity-40"
        >
          <FaChevronLeft className="text-xs" />
          {t("download.pagination.previous")}
        </motion.button>
        <motion.span
          key={currentPage}
          initial={{ y: -8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
          className="px-2 font-body text-sm font-medium text-ui-text"
        >
          {currentPage} / {totalPages}
        </motion.span>
        <motion.button
          onClick={onNextPage}
          disabled={offset + pageSize >= total}
          whileTap={offset + pageSize < total ? { scale: 0.95 } : undefined}
          className="flex items-center gap-1 rounded-full border-2 border-ui-border px-3 py-1.5 font-body text-sm font-semibold text-ui-text transition-all hover:border-ui-primary disabled:opacity-40"
        >
          {t("download.pagination.next")}
          <FaChevronRight className="text-xs" />
        </motion.button>
      </div>
    </div>
  )
}
