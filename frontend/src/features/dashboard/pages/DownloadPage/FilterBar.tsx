/**
 * FilterBar — top toolbar of the downloads page.
 *
 * Contains a debounced text search and a button that opens the FiltersModal.
 * The button shows a badge with the number of active filters when any exist.
 */
import { FaMagnifyingGlass, FaXmark, FaSliders } from "react-icons/fa6"

import { useI18n } from "@i18n/context/I18nContext"
import type { FileFilters } from "./index"

interface FilterBarProps {
  filters: FileFilters
  onNameSearch: (value: string) => void
  onOpenFilters: () => void
  activeFilterCount: number
}

export default function FilterBar({
  filters,
  onNameSearch,
  onOpenFilters,
  activeFilterCount,
}: FilterBarProps) {
  const { t } = useI18n()

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8">
      <div className="flex flex-row gap-2">
        {/* Search input with clear button */}
        <div className="relative w-full">
          <FaMagnifyingGlass className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-ui-text-muted" />
          <input
            type="text"
            value={filters.name}
            onChange={(e) => onNameSearch(e.target.value)}
            placeholder={t("download.filters.search")}
            className="h-10 w-full rounded-full border border-ui-border bg-ui-front pl-11 pr-10 font-body text-sm font-medium text-ui-text placeholder-ui-text-muted shadow-sm transition-all focus:border-ui-primary focus:outline-none focus:ring-2 focus:ring-ui-primary/20"
          />
          {/* Only shown while the search box has text */}
          {filters.name && (
            <button
              onClick={() => onNameSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-ui-text-muted transition-colors hover:bg-ui-border/50 hover:text-ui-text"
            >
              <FaXmark className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Trigger for the advanced filters modal */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenFilters}
            className="flex h-10 items-center gap-2 rounded-full border border-ui-border bg-ui-front px-4 text-sm font-medium text-ui-text transition-colors hover:border-ui-primary"
          >
            <FaSliders className="h-4 w-4 text-ui-text-muted" />
            <span>{t("download.filters.filtersButton")}</span>
            {/* Badge with the number of active filters */}
            {activeFilterCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-ui-primary px-1.5 font-heading text-xs font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
