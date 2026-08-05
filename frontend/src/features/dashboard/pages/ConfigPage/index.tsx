import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { motion } from "framer-motion"
import { FaGear, FaPalette } from "react-icons/fa6"
import { Check, Moon, Sun } from "lucide-react"
import clsx from "clsx"

import { useAuth } from "@auth/context/AuthContext"
import { useTheme } from "@theme/context/ThemeContext"
import { useToast } from "@toast/context/ToastContext"
import { useI18n } from "@i18n/context/I18nContext"
import { useLowDetail } from "@shared/hooks/useLowDetail"
import ApiClient from "@shared/utils/ApiClient"
import type { AuditEntry, User } from "@shared/utils/ApiClient/types"
import { setPageName } from "@shared/utils/setPageName"
import FloatingContainer from "../../components/FloatingContainer"
import Pagination from "../../components/Pagination"
import LogFilters, { EMPTY_LOG_FILTERS, type LogFiltersValue } from "./LogFilters"
import LogsTable from "./LogsTable"
import SummarySection, { type SummaryStats } from "./SummarySection"
import AccountSection from "./AccountSection"
import LanguageSelect from "./LanguageSelect"
import SectionHeader from "./SectionHeader"

const PAGE_SIZE = 15

const EMPTY_SUMMARY: SummaryStats = {
  accessibleCount: 0,
  accessibleBytes: 0,
  myBytes: 0,
  activeUsers: null,
  isOwner: false,
  hasQuota: false,
  quotaLimit: 0,
}

export default function ConfigPage() {
  const { token, user } = useAuth()
  const { theme, setTheme } = useTheme()
  const { toast, enabled: toastEnabled, setEnabled: setToastEnabled } = useToast()
  const { t } = useI18n()
  const { lowDetail, setLowDetail } = useLowDetail()

  const isOwner = user?.role === "owner"

  const apiClient = useMemo(() => {
    const client = new ApiClient()
    if (token) client.setToken(token)
    return client
  }, [token])

  useEffect(() => {
    setPageName(t("menu.config"))
  }, [t])

  const [summary, setSummary] = useState<SummaryStats>(EMPTY_SUMMARY)
  const [summaryLoading, setSummaryLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    const userId = user.id
    const hasUploadLimits = user.has_upload_limits
    const uploadLimit = user.upload_limit
    let active = true
    setSummaryLoading(true)

    const base: SummaryStats = {
      ...EMPTY_SUMMARY,
      isOwner,
      hasQuota: Boolean(hasUploadLimits),
      quotaLimit: hasUploadLimits ? uploadLimit : 0,
    }
    setSummary(base)

    apiClient
      .getAccessibleFiles(userId)
      .then((result) => {
        if (!active) return
        if (result.success && result.data.data) {
          const items = result.data.data
          const accessibleBytes = items.reduce((acc, f) => acc + (f.size_bytes ?? 0), 0)
          const myItems = items.filter((f) => f.uploaded_by === userId)
          const myBytes = myItems.reduce((acc, f) => acc + (f.size_bytes ?? 0), 0)
          setSummary((prev) => ({
            ...prev,
            accessibleCount: items.length,
            accessibleBytes,
            myBytes,
          }))
        } else {
          toast({
            type: "error",
            title: t("config.toast.summaryError"),
            description: t("config.toast.summaryErrorDesc"),
            duration: 4000,
          })
        }
      })
      .catch(() => {
        if (active) {
          toast({
            type: "error",
            title: t("config.toast.summaryError"),
            description: t("config.toast.summaryErrorDesc"),
            duration: 4000,
          })
        }
      })

    if (isOwner) {
      apiClient
        .getUsers({ limit: 1, is_active: true })
        .then((result) => {
          if (active && result.success && result.data.data) {
            setSummary((prev) => ({ ...prev, activeUsers: result.data.data?.total ?? 0 }))
          }
        })
        .catch(() => {
          // Active users count is a nice-to-have; fall back to placeholder.
        })
    }

    return () => {
      active = false
    }
  }, [apiClient, user?.id, user?.has_upload_limits, user?.upload_limit, isOwner, toast, t])

  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const [filters, setFilters] = useState<LogFiltersValue>(EMPTY_LOG_FILTERS)
  const [users, setUsers] = useState<User[]>([])

  const fetchUsers = useCallback(async () => {
    const result = await apiClient.getUsers({ limit: 100 })
    if (result.success && result.data.data) {
      setUsers(result.data.data.items ?? [])
    }
  }, [apiClient])

  useEffect(() => {
    if (!isOwner) return
    fetchUsers()
  }, [isOwner, fetchUsers])

  const fetchLogs = useCallback(
    async (off: number) => {
      setLoading(true)
      const params: Record<string, string | number | boolean> = {
        limit: PAGE_SIZE,
        offset: off,
      }
      if (filters.event_type) params.event_type = filters.event_type
      if (filters.success === "true") params.success = true
      if (filters.success === "false") params.success = false
      if (filters.user_id) params.user_id = Number(filters.user_id)
      if (filters.start_date) params.start = `${filters.start_date} 00:00:00`
      if (filters.end_date) params.end = `${filters.end_date} 23:59:59`

      const result = await apiClient.getAudit(params)
      if (result.success && result.data) {
        const entries = result.data.data ?? []
        setLogs(entries)
        setTotal(entries.length > 0 ? (entries[0].total_count ?? 0) : 0)
      } else {
        toast({
          type: "error",
          title: t("config.toast.fetchError"),
          description: t("config.toast.fetchErrorDesc"),
          duration: 4000,
        })
        setLogs([])
        setTotal(0)
      }
      setLoading(false)
    },
    [apiClient, filters, toast, t]
  )

  useEffect(() => {
    if (!isOwner) {
      setLoading(false)
      return
    }
    fetchLogs(offset)
  }, [offset, filters, isOwner, fetchLogs])

  const applyFilters = useCallback(() => {
    setOffset(0)
  }, [])

  const clearFilters = useCallback(() => {
    setFilters(EMPTY_LOG_FILTERS)
    setOffset(0)
  }, [])

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  return (
    <div className="flex h-full flex-col overflow-y-auto scrollbar scrollbar-thin scrollbar-thumb-ui-border scrollbar-track-transparent">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 p-4 sm:gap-6 sm:p-6 lg:grid-cols-12">
        {/* Fila 1: Encabezado */}
        <motion.div
          className="lg:col-span-12"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
          style={{ opacity: 0 }}
        >
          <FloatingContainer className="w-full !items-stretch border border-ui-border !p-5 sm:!p-6">
            <div className="flex w-full items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-ui-border-muted bg-ui-front">
                <FaGear className="text-xl text-ui-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-heading text-2xl font-bold tracking-tight text-ui-text">
                  {t("menu.config")}
                </h2>
                <p className="mt-1 font-body text-sm font-medium text-ui-text-muted">
                  {t("config.subtitle")}
                </p>
              </div>
            </div>
          </FloatingContainer>
        </motion.div>

        {/* Fila 2: Resumen (ancho completo) */}
        <motion.div
          className="lg:col-span-12"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.2, 0, 0, 1], delay: 0.08 }}
          style={{ opacity: 0 }}
        >
          <SummarySection stats={summary} loading={summaryLoading} />
        </motion.div>

        {/* Fila 3: Dos columnas – Preferencias de la UI (izquierda) + Mi cuenta (derecha) */}
        <motion.div
          className="lg:col-span-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.2, 0, 0, 1], delay: 0.16 }}
          style={{ opacity: 0 }}
        >
          <FloatingContainer className="h-full w-full !items-stretch border border-ui-border !p-5 sm:!p-6">
            <div className="flex w-full flex-col gap-5">
              <SectionHeader
                icon={<FaPalette className="text-xl text-ui-secondary" />}
                title={t("config.ui.title")}
                subtitle={t("config.ui.subtitle")}
              />

              {/* Controles en columna */}
              <div className="flex w-full flex-col gap-6">
                {/* Fila: Tema (botones píldora) */}
                <div className="flex w-full flex-col gap-3">
                  <h4 className="font-body text-xs font-semibold uppercase tracking-wider text-ui-text-muted">
                    {t("config.ui.theme")}
                  </h4>
                  <div className="flex w-full gap-3">
                    <ThemeOption
                      label={t("config.ui.themeLight")}
                      icon={<Sun className="h-4 w-4" />}
                      active={theme === "light"}
                      onClick={() => setTheme("light")}
                    />
                    <ThemeOption
                      label={t("config.ui.themeDark")}
                      icon={<Moon className="h-4 w-4" />}
                      active={theme === "dark"}
                      onClick={() => setTheme("dark")}
                    />
                  </div>
                </div>

                {/* Fila: Idioma */}
                <div className="flex w-full flex-col gap-3">
                  <h4 className="font-body text-xs font-semibold uppercase tracking-wider text-ui-text-muted">
                    {t("config.ui.language")}
                  </h4>
                  <LanguageSelect />
                </div>
              </div>

              <ToggleRow
                label={t("config.ui.lowDetail")}
                description={t("config.ui.lowDetailDesc")}
                checked={lowDetail}
                onChange={() => setLowDetail(!lowDetail)}
              />

              <ToggleRow
                label={t("config.ui.toastNotifications")}
                description={t("config.ui.toastNotificationsDesc")}
                checked={toastEnabled}
                onChange={() => setToastEnabled(!toastEnabled)}
              />
            </div>
          </FloatingContainer>
        </motion.div>

        <motion.div
          className="h-full lg:col-span-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.2, 0, 0, 1], delay: 0.24 }}
          style={{ opacity: 0 }}
        >
          <AccountSection myBytes={summary.myBytes} />
        </motion.div>

        {/* Filas 4 y 5: Filtros + Logs (solo administrador, ancho completo) */}
        {isOwner && (
          <>
            <motion.div
              className="lg:col-span-12"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.2, 0, 0, 1], delay: 0.32 }}
              style={{ opacity: 0 }}
            >
              <LogFilters
                value={filters}
                users={users}
                onValueChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
                onApply={applyFilters}
                onClear={clearFilters}
              />
            </motion.div>

            <motion.div
              className="lg:col-span-12"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.2, 0, 0, 1], delay: 0.4 }}
              style={{ opacity: 0 }}
            >
              <LogsTable logs={logs} loading={loading} />
            </motion.div>

            {total > PAGE_SIZE && (
              <motion.div
                className="lg:col-span-12"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: [0.2, 0, 0, 1], delay: 0.48 }}
                style={{ opacity: 0 }}
              >
                <Pagination
                  total={total}
                  offset={offset}
                  pageSize={PAGE_SIZE}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPrevPage={() => setOffset((p) => Math.max(0, p - PAGE_SIZE))}
                  onNextPage={() =>
                    setOffset((p) => Math.min((totalPages - 1) * PAGE_SIZE, p + PAGE_SIZE))
                  }
                />
              </motion.div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

interface ThemeOptionProps {
  label: string
  icon: ReactNode
  active: boolean
  onClick: () => void
}

function ThemeOption({ label, icon, active, onClick }: ThemeOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full border-2 px-4 py-2.5 font-body text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-primary/40 active:scale-[0.98]",
        active
          ? "border-ui-primary bg-ui-primary/10 text-ui-primary"
          : "border-ui-border-muted bg-ui-front text-ui-text-muted hover:border-ui-primary/50 hover:text-ui-text"
      )}
    >
      {icon}
      {label}
      {active && <Check className="h-4 w-4 shrink-0" />}
    </button>
  )
}

interface ToggleRowProps {
  label: string
  description: string
  checked: boolean
  onChange: () => void
}

function ToggleRow({ label, description, checked, onChange }: ToggleRowProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="flex w-full cursor-pointer items-center justify-between gap-4 rounded-xl border border-ui-border-muted bg-ui-front px-4 py-3 text-left transition-colors duration-200 hover:border-ui-primary/50 hover:bg-ui-highlight/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-primary/40"
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="font-body text-sm font-medium text-ui-text">{label}</span>
        <span className="font-body text-xs text-ui-text-muted">{description}</span>
      </div>
      <span
        className={clsx(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200",
          checked ? "bg-ui-primary" : "bg-ui-border"
        )}
      >
        <span
          className={clsx(
            "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200",
            checked ? "translate-x-6" : "translate-x-1"
          )}
        />
      </span>
    </button>
  )
}
