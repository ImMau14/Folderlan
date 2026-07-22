import { motion } from "framer-motion"
import { FaSearch, FaFilter } from "react-icons/fa"
import clsx from "clsx"

import { useI18n } from "@i18n/context/I18nContext"
import FloatingContainer from "../../components/FloatingContainer"
import type { FileFilters } from "./index"

interface SearchBarProps {
  filters: FileFilters
  showFilters: boolean
  onToggleFilters: () => void
  onNameSearch: (value: string) => void
  onFilterChange: (key: keyof FileFilters, value: string) => void
  onApplyFilters: () => void
  onClearFilters: () => void
}

export default function SearchBar({
  filters,
  showFilters,
  onToggleFilters,
  onNameSearch,
  onFilterChange,
  onApplyFilters,
  onClearFilters,
}: SearchBarProps) {
  const { t } = useI18n()

  return (
    <FloatingContainer className="w-full border border-ui-border">
      <div className="flex w-full items-center gap-3">
        <div className="relative flex-1">
          <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ui-text-muted" />
          <input
            type="text"
            value={filters.name}
            onChange={(e) => onNameSearch(e.target.value)}
            placeholder={t("download.filters.search")}
            className="w-full rounded-full border-2 border-ui-border bg-ui-front py-2 pl-9 pr-4 font-body text-sm text-ui-text placeholder-ui-text-muted transition-colors focus:border-ui-primary focus:outline-none focus:ring-2 focus:ring-ui-primary"
          />
        </div>
        <motion.button
          onClick={onToggleFilters}
          whileTap={{ scale: 0.95 }}
          className={clsx(
            "flex items-center gap-2 rounded-full border-2 px-4 py-2 font-body text-sm font-semibold transition-colors",
            showFilters
              ? "border-ui-primary bg-ui-primary text-ui-highlight dark:text-ui-base"
              : "border-ui-border bg-ui-front text-ui-text hover:border-ui-primary"
          )}
        >
          <motion.span
            animate={{ rotate: showFilters ? 180 : 0 }}
            transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
          >
            <FaFilter />
          </motion.span>
          {t("download.filters.toggleFilters")}
        </motion.button>
      </div>

      <div
        className="grid transition-[grid-template-rows] duration-200 ease-[cubic-bezier(0.2,0,0,1)]"
        style={{ gridTemplateRows: showFilters ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 overflow-hidden">
          <motion.div
            initial={false}
            animate={{ opacity: showFilters ? 1 : 0, y: showFilters ? 0 : -12 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className="mt-4 grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div className="flex flex-col gap-1">
              <label className="font-body text-xs font-semibold text-ui-text-muted">
                {t("download.filters.minSize")}
              </label>
              <input
                type="number"
                value={filters.min_size}
                onChange={(e) => onFilterChange("min_size", e.target.value)}
                placeholder="0"
                className="rounded-full border-2 border-ui-border bg-ui-front px-3 py-2 font-body text-sm text-ui-text placeholder-ui-text-muted transition-colors focus:border-ui-primary focus:outline-none focus:ring-2 focus:ring-ui-primary"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-body text-xs font-semibold text-ui-text-muted">
                {t("download.filters.maxSize")}
              </label>
              <input
                type="number"
                value={filters.max_size}
                onChange={(e) => onFilterChange("max_size", e.target.value)}
                placeholder="999999"
                className="rounded-full border-2 border-ui-border bg-ui-front px-3 py-2 font-body text-sm text-ui-text placeholder-ui-text-muted transition-colors focus:border-ui-primary focus:outline-none focus:ring-2 focus:ring-ui-primary"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-body text-xs font-semibold text-ui-text-muted">
                {t("download.filters.startDate")}
              </label>
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => onFilterChange("start_date", e.target.value)}
                className="rounded-full border-2 border-ui-border bg-ui-front px-3 py-2 font-body text-sm text-ui-text transition-colors focus:border-ui-primary focus:outline-none focus:ring-2 focus:ring-ui-primary"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-body text-xs font-semibold text-ui-text-muted">
                {t("download.filters.endDate")}
              </label>
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => onFilterChange("end_date", e.target.value)}
                className="rounded-full border-2 border-ui-border bg-ui-front px-3 py-2 font-body text-sm text-ui-text transition-colors focus:border-ui-primary focus:outline-none focus:ring-2 focus:ring-ui-primary"
              />
            </div>
            <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
              <motion.button
                onClick={onApplyFilters}
                whileTap={{ scale: 0.95 }}
                className="rounded-full bg-ui-primary px-6 py-2 font-body text-sm font-semibold text-ui-highlight transition-colors hover:bg-ui-primary-hover active:bg-ui-primary-active dark:text-ui-base"
              >
                {t("download.filters.apply")}
              </motion.button>
              <motion.button
                onClick={onClearFilters}
                whileTap={{ scale: 0.95 }}
                className="rounded-full border-2 border-ui-border bg-ui-front px-6 py-2 font-body text-sm font-semibold text-ui-text transition-colors hover:border-ui-primary"
              >
                {t("download.filters.clear")}
              </motion.button>
            </div>
          </motion.div>
        </div>
      </div>
    </FloatingContainer>
  )
}
