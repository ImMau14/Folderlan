import { FaFilter } from "react-icons/fa6"
import clsx from "clsx"

import { useI18n } from "@i18n/context/I18nContext"
import type { User } from "@shared/utils/ApiClient/types"
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

const selectClass =
  "rounded-full border-2 border-ui-border bg-ui-front px-3 py-2 font-body text-sm text-ui-text transition-colors focus:border-ui-primary focus:outline-none focus:ring-2 focus:ring-ui-primary"

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

  return (
    <FloatingContainer
      className={clsx("w-full !items-stretch border border-ui-border !p-5 sm:!p-6")}
    >
      <div className="flex w-full flex-col gap-4">
        <div className="flex items-center gap-3">
          <FaFilter
            className={clsx(
              "shrink-0 text-sm",
              hasActiveFilters ? "text-ui-primary" : "text-ui-text-muted"
            )}
          />
          <h3 className="font-heading text-base font-bold text-ui-text">
            {t("config.filters.title")}
          </h3>
          {hasActiveFilters && <span className="h-2 w-2 rounded-full bg-ui-primary" />}
        </div>

        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="font-body text-xs font-semibold uppercase tracking-wider text-ui-text-muted">
              {t("config.filters.eventType")}
            </span>
            <select
              value={value.event_type}
              onChange={(e) => onValueChange({ event_type: e.target.value })}
              className={selectClass}
            >
              <option value="">{t("config.filters.allEvents")}</option>
              {EVENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`config.eventTypes.${type}`)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-body text-xs font-semibold uppercase tracking-wider text-ui-text-muted">
              {t("config.filters.status")}
            </span>
            <select
              value={value.success}
              onChange={(e) => onValueChange({ success: e.target.value })}
              className={selectClass}
            >
              <option value="">{t("config.filters.allStatus")}</option>
              <option value="true">{t("config.status.success")}</option>
              <option value="false">{t("config.status.failed")}</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-body text-xs font-semibold uppercase tracking-wider text-ui-text-muted">
              {t("config.filters.user")}
            </span>
            <select
              value={value.user_id}
              onChange={(e) => onValueChange({ user_id: e.target.value })}
              className={selectClass}
            >
              <option value="">{t("config.filters.allUsers")}</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.username}
                </option>
              ))}
            </select>
          </label>

          <div className="hidden sm:block" />
        </div>

        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="font-body text-xs font-semibold uppercase tracking-wider text-ui-text-muted">
              {t("config.filters.startDate")}
            </span>
            <input
              type="date"
              value={value.start_date}
              onChange={(e) => onValueChange({ start_date: e.target.value })}
              className={selectClass}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-body text-xs font-semibold uppercase tracking-wider text-ui-text-muted">
              {t("config.filters.endDate")}
            </span>
            <input
              type="date"
              value={value.end_date}
              onChange={(e) => onValueChange({ end_date: e.target.value })}
              className={selectClass}
            />
          </label>
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            onClick={onClear}
            className="rounded-full border-2 border-ui-border bg-ui-front px-4 py-2 font-body text-sm font-semibold text-ui-text transition-all hover:border-ui-primary"
          >
            {t("config.filters.clear")}
          </button>
          <button
            onClick={onApply}
            className="flex items-center justify-center gap-2 rounded-full bg-ui-primary px-4 py-2 font-body text-sm font-semibold text-ui-highlight transition-all hover:bg-ui-primary-hover dark:text-ui-base"
          >
            <FaFilter className="text-xs" />
            {t("config.filters.apply")}
          </button>
        </div>
      </div>
    </FloatingContainer>
  )
}
