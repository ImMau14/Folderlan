/**
 * FiltersModal — advanced filter editor for the downloads page.
 *
 * Lets the user refine the list by uploader, visibility, size range and
 * upload date range. Changes are only applied when "Apply" is pressed;
 * "Clear" resets every filter except the search text.
 */
import { useState, useCallback, useMemo } from "react"
import { FaSliders } from "react-icons/fa6"

import { useI18n } from "@i18n/context/I18nContext"
import { useModal } from "@modal/context/ModalContext"
import ApiClient from "@shared/utils/ApiClient"
import type { User } from "@shared/utils/ApiClient/types"
import Select from "@shared/components/Select"
import type { FileFilters } from "./index"

interface FiltersModalProps {
  filters: FileFilters
  apiClient: ApiClient
  onApply: (filters: FileFilters) => void
}

export default function FiltersModal({ filters, apiClient, onApply }: FiltersModalProps) {
  const { t } = useI18n()
  const { close } = useModal()

  // Local state mirrors the current filters so nothing changes until Apply.
  const [visibility, setVisibility] = useState(filters.visibility)
  const [uploadedBy, setUploadedBy] = useState(filters.uploaded_by)
  const [minSize, setMinSize] = useState(filters.min_size)
  const [maxSize, setMaxSize] = useState(filters.max_size)
  const [startDate, setStartDate] = useState(filters.start_date)
  const [endDate, setEndDate] = useState(filters.end_date)
  const [users, setUsers] = useState<User[]>([])
  const [initialized, setInitialized] = useState(false)

  // Lazy init: fetch the user list for the "uploaded by" selector once.
  const initialize = useCallback(async () => {
    if (initialized) return
    setInitialized(true)
    const usersResult = await apiClient.getUsers({ limit: 200 })
    if (usersResult.success) {
      setUsers(usersResult.data.data?.items ?? [])
    }
  }, [initialized, apiClient])

  if (!initialized) {
    initialize()
  }

  // True when any local value differs from the applied filters.
  const hasChanges = useMemo(
    () =>
      visibility !== filters.visibility ||
      uploadedBy !== filters.uploaded_by ||
      minSize !== filters.min_size ||
      maxSize !== filters.max_size ||
      startDate !== filters.start_date ||
      endDate !== filters.end_date,
    [filters, visibility, uploadedBy, minSize, maxSize, startDate, endDate]
  )

  // Push the edited filters up (keeping the search text) and close the modal.
  const handleApply = useCallback(() => {
    onApply({
      name: filters.name,
      visibility,
      uploaded_by: uploadedBy,
      min_size: minSize,
      max_size: maxSize,
      start_date: startDate,
      end_date: endDate,
    })
    close()
  }, [onApply, filters.name, visibility, uploadedBy, minSize, maxSize, startDate, endDate, close])

  // Reset everything except the search text and close the modal.
  const handleClear = useCallback(() => {
    onApply({
      name: filters.name,
      visibility: "",
      uploaded_by: "",
      min_size: "",
      max_size: "",
      start_date: "",
      end_date: "",
    })
    close()
  }, [onApply, filters.name, close])

  const userOptions = useMemo(
    () => users.map((u) => ({ value: String(u.id), label: u.username })),
    [users]
  )

  // Shared input styling. `dark:[color-scheme:dark]` makes native controls
  // (date picker icons, scrollbars) render in dark mode; inputs stay pill-shaped.
  const inputBaseClasses =
    "h-10 w-full rounded-full border border-ui-border bg-ui-front px-3 text-sm text-ui-text placeholder-ui-text-muted transition-all focus:border-ui-primary focus:outline-none focus:ring-1 focus:ring-ui-primary dark:[color-scheme:dark]"

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-ui-border pb-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-ui-border bg-ui-base shadow-sm">
          <FaSliders className="text-xl text-ui-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-heading text-xl font-bold text-ui-text">
            {t("download.filters.title")}
          </h3>
          <p className="mt-0.5 font-body text-sm text-ui-text-muted">
            {t("download.filters.subtitle")}
          </p>
        </div>
      </div>

      {/* Form fields */}
      <div className="flex flex-col gap-5">
        {/* Uploader + visibility selectors */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <h4 className="font-heading text-xs font-bold uppercase tracking-wider text-ui-text-muted">
              {t("download.filters.user")}
            </h4>
            <Select
              value={uploadedBy}
              placeholder={t("download.filters.allUsers")}
              options={userOptions}
              onChange={setUploadedBy}
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <h4 className="font-heading text-xs font-bold uppercase tracking-wider text-ui-text-muted">
              {t("download.filters.visibility")}
            </h4>
            <Select
              value={visibility}
              placeholder={t("download.filters.all")}
              options={[
                { value: "", label: t("download.filters.all") },
                { value: "public", label: t("download.filters.public") },
                { value: "private", label: t("download.filters.private") },
              ]}
              onChange={setVisibility}
            />
          </div>
        </div>

        {/* Section divider */}
        <hr className="border-t border-ui-border" />

        {/* Size range inputs */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <h4 className="font-heading text-xs font-bold uppercase tracking-wider text-ui-text-muted">
              {t("download.filters.minSize")}
            </h4>
            <input
              type="number"
              min={0}
              value={minSize}
              onChange={(e) => setMinSize(e.target.value)}
              placeholder={t("download.filters.minSize")}
              aria-label={t("download.filters.minSize")}
              className={inputBaseClasses}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <h4 className="font-heading text-xs font-bold uppercase tracking-wider text-ui-text-muted">
              {t("download.filters.maxSize")}
            </h4>
            <input
              type="number"
              min={0}
              value={maxSize}
              onChange={(e) => setMaxSize(e.target.value)}
              placeholder={t("download.filters.maxSize")}
              aria-label={t("download.filters.maxSize")}
              className={inputBaseClasses}
            />
          </div>
        </div>

        {/* Upload date range inputs */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <h4 className="font-heading text-xs font-bold uppercase tracking-wider text-ui-text-muted">
              {t("download.filters.startDate")}
            </h4>
            <input
              type="date"
              max={endDate || undefined}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder={t("download.filters.startDate")}
              aria-label={t("download.filters.startDate")}
              className={inputBaseClasses}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <h4 className="font-heading text-xs font-bold uppercase tracking-wider text-ui-text-muted">
              {t("download.filters.endDate")}
            </h4>
            <input
              type="date"
              min={startDate || undefined}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder={t("download.filters.endDate")}
              aria-label={t("download.filters.endDate")}
              className={inputBaseClasses}
            />
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="mt-2 flex w-full gap-3">
        <button
          onClick={handleClear}
          className="flex flex-1 items-center justify-center rounded-full border-2 border-ui-border bg-ui-front px-4 py-2.5 font-body text-sm font-semibold text-ui-text transition-all hover:border-ui-primary"
        >
          {t("download.filters.clear")}
        </button>
        <button
          onClick={handleApply}
          disabled={!hasChanges}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-ui-primary px-4 py-2.5 font-body text-sm font-semibold text-white transition-all hover:bg-ui-primary-hover disabled:pointer-events-none disabled:opacity-50 dark:text-ui-base"
        >
          {t("download.filters.apply")}
        </button>
      </div>
    </div>
  )
}
