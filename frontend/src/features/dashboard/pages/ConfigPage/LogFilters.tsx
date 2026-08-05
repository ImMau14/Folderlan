import { FaFilter } from "react-icons/fa6"
import clsx from "clsx"

import { useI18n } from "@i18n/context/I18nContext"
import type { User } from "@shared/utils/ApiClient/types"
import Select from "@shared/components/Select"
import FloatingContainer from "../../components/FloatingContainer"

export interface LogFiltersValue {
  event_type: string
  success: string
  user_id: string
  start_date: string
  end_date: string
}

export const EMPTY_LOG_FILTERS: LogFiltersValue = {
  event_type: "",
  success: "",
  user_id: "",
  start_date: "",
  end_date: "",
}

export const EVENT_TYPES = [
  "FILE_UPLOAD",
  "FILE_SOFT_DELETE",
  "FILE_RESTORE",
  "PERMISSION_GRANT",
  "PERMISSION_UPDATE",
  "PERMISSION_REVOKE",
  "USER_PERM_UPDATE",
  "USER_ACTIVE_UPDATE",
  "USER_SOFT_DELETE",
  "USER_RESTORE",
]

interface LogFiltersProps {
  value: LogFiltersValue
  users: User[]
  onValueChange: (patch: Partial<LogFiltersValue>) => void
  onApply: () => void
  onClear: () => void
}

// Inputs de fecha con el mismo estilo que el Select (estado por defecto)
const inputDateClass = [
  "block w-full h-10 rounded-full border px-4 font-body text-sm transition-all",
  "border-ui-border bg-ui-front text-ui-text placeholder:text-ui-text-muted",
  "focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ui-primary/40",
  "disabled:cursor-not-allowed disabled:opacity-50",
  "dark:[color-scheme:dark]",
].join(" ")

export default function LogFilters({
  value,
  users,
  onValueChange,
  onApply,
  onClear,
}: LogFiltersProps) {
  const { t } = useI18n()

  const hasActiveFilters =
    value.event_type !== "" ||
    value.success !== "" ||
    value.user_id !== "" ||
    value.start_date !== "" ||
    value.end_date !== ""

  const eventOptions = EVENT_TYPES.map((type) => ({
    value: type,
    label: t(`config.eventTypes.${type}`),
  }))

  const statusOptions = [
    { value: "", label: t("config.filters.allStatus") },
    { value: "true", label: t("config.status.success") },
    { value: "false", label: t("config.status.failed") },
  ]

  const userOptions = users.map((u) => ({
    value: String(u.id),
    label: u.username,
  }))

  return (
    <FloatingContainer className="w-full !items-stretch border border-ui-border !p-5 sm:!p-6">
      <div className="flex w-full flex-col gap-4">
        {/* Encabezado */}
        <div className="flex items-center gap-3">
          <div
            className={clsx(
              "flex h-10 w-10 items-center justify-center rounded-full border shadow-sm",
              hasActiveFilters
                ? "border-ui-primary/30 bg-ui-primary/10 text-ui-primary"
                : "border-ui-border-muted bg-ui-front text-ui-text-muted"
            )}
          >
            <FaFilter className="text-sm" />
          </div>
          <div>
            <h3 className="font-heading text-lg font-bold text-ui-text">
              {t("config.filters.title")}
            </h3>
            <p className="text-xs text-ui-text-muted">
              {hasActiveFilters
                ? t("config.filters.activeFilters")
                : t("config.filters.noActiveFilters")}
            </p>
          </div>
        </div>

        {/* Controles de filtro */}
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-ui-text-muted">
              {t("config.filters.eventType")}
            </span>
            <Select
              value={value.event_type}
              placeholder={t("config.filters.allEvents")}
              options={eventOptions}
              onChange={(v) => onValueChange({ event_type: v })}
              className="w-full"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-ui-text-muted">
              {t("config.filters.status")}
            </span>
            <Select
              value={value.success}
              placeholder={t("config.filters.allStatus")}
              options={statusOptions}
              onChange={(v) => onValueChange({ success: v })}
              className="w-full"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-ui-text-muted">
              {t("config.filters.user")}
            </span>
            <Select
              value={value.user_id}
              placeholder={t("config.filters.allUsers")}
              options={userOptions}
              onChange={(v) => onValueChange({ user_id: v })}
              className="w-full"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-ui-text-muted">
              {t("config.filters.startDate")}
            </span>
            <input
              type="date"
              value={value.start_date}
              onChange={(e) => onValueChange({ start_date: e.target.value })}
              className={inputDateClass}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-ui-text-muted">
              {t("config.filters.endDate")}
            </span>
            <input
              type="date"
              value={value.end_date}
              onChange={(e) => onValueChange({ end_date: e.target.value })}
              className={inputDateClass}
            />
          </label>
        </div>

        {/* Botones de acción */}
        <div className="flex w-full items-center justify-end gap-3 border-t border-ui-border-muted pt-4">
          <button
            onClick={onClear}
            className="rounded-full border-2 border-ui-border bg-ui-front px-4 py-2 text-sm font-semibold text-ui-text transition-all hover:border-ui-primary hover:text-ui-primary"
          >
            {t("config.filters.clear")}
          </button>
          <button
            onClick={onApply}
            className="flex items-center gap-2 rounded-full bg-ui-primary px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-ui-primary-hover active:scale-[0.98] dark:text-ui-base"
          >
            <FaFilter className="text-xs" />
            {t("config.filters.apply")}
          </button>
        </div>
      </div>
    </FloatingContainer>
  )
}
