/**
 * LogsTable — owner-only list of audit-log entries.
 *
 * Renders a desktop table and a mobile card list of the fetched audit
 * entries with animated enter/exit transitions. Each entry shows timestamp,
 * user, event type (color-coded), description, file, IP and success status.
 * Falls back to loading and empty states when appropriate.
 */
import { AnimatePresence, motion } from "framer-motion"
import { FaListCheck } from "react-icons/fa6"
import clsx from "clsx"

import { useI18n } from "@i18n/context/I18nContext"
import type { AuditEntry } from "@shared/utils/ApiClient/types"
import { formatSqliteDatetime } from "@shared/utils/formatDatetime"
import FloatingContainer from "../../components/FloatingContainer"

interface LogsTableProps {
  logs: AuditEntry[]
  loading: boolean
}

function eventLabel(eventType: string | undefined, t: ReturnType<typeof useI18n>["t"]): string {
  if (!eventType) return "—"
  const label = t(`config.eventTypes.${eventType}`)
  return label.startsWith("config.eventTypes") ? eventType : label
}

function eventClass(eventType: string | undefined): string {
  if (!eventType) return "bg-ui-front text-ui-text-muted"
  if (eventType.startsWith("FILE_")) return "bg-ui-info/15 text-ui-info"
  if (eventType.startsWith("PERMISSION_")) return "bg-ui-warning/15 text-ui-warning"
  if (eventType.startsWith("USER_")) return "bg-ui-secondary/15 text-ui-secondary"
  return "bg-ui-front text-ui-text-muted"
}

export default function LogsTable({ logs, loading }: LogsTableProps) {
  const { t } = useI18n()

  if (loading && logs.length === 0) {
    return (
      <FloatingContainer className="min-h-[300px] w-full border border-ui-border">
        <div className="flex flex-col items-center gap-4 py-16">
          <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-ui-border border-t-ui-primary" />
          <p className="font-body text-sm font-medium text-ui-text-muted">
            {t("config.table.loading")}
          </p>
        </div>
      </FloatingContainer>
    )
  }

  if (logs.length === 0) {
    return (
      <FloatingContainer className="min-h-[300px] w-full border border-ui-border">
        <div className="flex flex-col items-center gap-3 py-16">
          <FaListCheck className="text-3xl text-ui-text-muted/40" />
          <p className="font-heading text-lg font-bold text-ui-text">{t("config.table.noLogs")}</p>
          <p className="font-body text-sm text-ui-text-muted">{t("config.table.noLogsDesc")}</p>
        </div>
      </FloatingContainer>
    )
  }

  return (
    <FloatingContainer className="w-full border border-ui-border">
      {/* Desktop table */}
      <div className="hidden w-full overflow-x-auto scrollbar scrollbar-thin scrollbar-thumb-ui-border scrollbar-track-transparent md:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-ui-border font-body text-xs font-semibold uppercase tracking-wider text-ui-text-muted">
              <th className="px-4 py-3.5 text-left">{t("config.table.timestamp")}</th>
              <th className="px-4 py-3.5 text-left">{t("config.table.user")}</th>
              <th className="px-4 py-3.5 text-left">{t("config.table.event")}</th>
              <th className="px-4 py-3.5 text-left">{t("config.table.description")}</th>
              <th className="px-4 py-3.5 text-left">{t("config.table.file")}</th>
              <th className="px-4 py-3.5 text-left">{t("config.table.ip")}</th>
              <th className="px-4 py-3.5 text-center">{t("config.table.status")}</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence mode="popLayout">
              {logs.map((log, idx) => (
                <motion.tr
                  key={log.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25, delay: idx * 0.03, ease: [0.2, 0, 0, 1] }}
                  layout
                  className={clsx(
                    "group border-ui-border-muted transition-colors hover:bg-ui-front/70",
                    idx === logs.length - 1 ? "" : "border-b"
                  )}
                >
                  <td className="whitespace-nowrap px-4 py-3.5 font-body text-sm text-ui-text-muted">
                    {formatSqliteDatetime(log.timestamp)}
                  </td>
                  <td className="max-w-[140px] truncate px-4 py-3.5 font-body text-sm text-ui-text">
                    {log.username ?? `#${log.user_id ?? "?"}`}
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={clsx(
                        "inline-block rounded-lg px-2.5 py-1 font-body text-xs font-semibold",
                        eventClass(log.event_type)
                      )}
                    >
                      {eventLabel(log.event_type, t)}
                    </span>
                  </td>
                  <td className="max-w-[280px] px-4 py-3.5">
                    <span
                      className="line-clamp-2 block font-body text-sm text-ui-text-muted"
                      title={log.description ?? undefined}
                    >
                      {log.description ?? "—"}
                    </span>
                  </td>
                  <td className="max-w-[120px] truncate px-4 py-3.5 font-body text-sm text-ui-text-muted">
                    {log.file_name ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 font-body text-sm text-ui-text-muted">
                    {log.ip_address ?? "—"}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span
                      className={clsx(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-body text-xs font-semibold",
                        log.success
                          ? "bg-ui-success/15 text-ui-success"
                          : "bg-ui-danger/10 text-ui-danger"
                      )}
                    >
                      <span
                        className={clsx(
                          "h-1.5 w-1.5 rounded-full",
                          log.success ? "bg-ui-success" : "bg-ui-danger"
                        )}
                      />
                      {log.success ? t("config.status.success") : t("config.status.failed")}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="flex w-full flex-col gap-2 p-2 md:hidden">
        <AnimatePresence mode="popLayout">
          {logs.map((log, idx) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25, delay: idx * 0.03, ease: [0.2, 0, 0, 1] }}
              layout
              className="flex flex-col gap-2 rounded-xl border border-ui-border-muted bg-ui-front/50 p-3 transition-colors hover:bg-ui-front"
            >
              <div className="flex items-center gap-2">
                <span
                  className={clsx(
                    "rounded-lg px-2 py-0.5 font-body text-xs font-semibold",
                    eventClass(log.event_type)
                  )}
                >
                  {eventLabel(log.event_type, t)}
                </span>
                <span
                  className={clsx(
                    "ml-auto rounded-full px-2 py-0.5 font-body text-xs font-semibold",
                    log.success
                      ? "bg-ui-success/15 text-ui-success"
                      : "bg-ui-danger/10 text-ui-danger"
                  )}
                >
                  {log.success ? t("config.status.success") : t("config.status.failed")}
                </span>
              </div>
              <p className="line-clamp-2 font-body text-sm text-ui-text-muted">
                {log.description ?? "—"}
              </p>
              <div className="flex items-center justify-between text-xs text-ui-text-muted">
                <span className="truncate">
                  {log.username ?? `#${log.user_id ?? "?"}`}
                  {log.file_name ? ` · ${log.file_name}` : ""}
                  {log.ip_address ? ` · ${log.ip_address}` : ""}
                </span>
                <span className="ml-2 shrink-0">{formatSqliteDatetime(log.timestamp)}</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </FloatingContainer>
  )
}
