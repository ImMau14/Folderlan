import { useCallback, useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { FaGear, FaLock, FaPalette } from "react-icons/fa6"
import { FiMoon, FiSun } from "react-icons/fi"
import clsx from "clsx"

import { useAuth } from "@auth/context/AuthContext"
import { useTheme } from "@theme/context/ThemeContext"
import { useToast } from "@toast/context/ToastContext"
import { useI18n } from "@i18n/context/I18nContext"
import { LanguageSwitcher } from "@i18n/components/LanguageSwitcher"
import ApiClient from "@shared/utils/ApiClient"
import type { AuditEntry, User } from "@shared/utils/ApiClient/types"
import FloatingContainer from "../../components/FloatingContainer"
import Pagination from "../../components/Pagination"
import LogFilters, { EMPTY_LOG_FILTERS, type LogFiltersValue } from "./LogFilters"
import LogsTable from "./LogsTable"

const PAGE_SIZE = 15

export default function ConfigPage() {
  const { token, user } = useAuth()
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()
  const { t } = useI18n()

  const isOwner = user?.role === "owner"

  const apiClient = useMemo(() => {
    const client = new ApiClient()
    if (token) client.setToken(token)
    return client
  }, [token])

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
        toast({ type: "error", title: t("config.toast.fetchError"), duration: 4000 })
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
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 sm:gap-6 sm:p-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
          style={{ opacity: 0 }}
        >
          <FloatingContainer className="w-full !items-stretch !p-5 sm:!p-6">
            <div className="flex w-full items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-ui-border-muted bg-ui-front">
                <FaGear className="text-xl text-ui-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-heading text-xl font-bold tracking-tight text-ui-text">
                  {t("menu.config")}
                </h2>
                <p className="mt-1 font-body text-sm font-medium text-ui-text-muted">
                  {t("config.subtitle")}
                </p>
              </div>
            </div>
          </FloatingContainer>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.2, 0, 0, 1], delay: 0.08 }}
          style={{ opacity: 0 }}
        >
          <FloatingContainer className="w-full !items-stretch !p-5 sm:!p-6">
            <div className="flex w-full flex-col gap-5">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-ui-border-muted bg-ui-front">
                  <FaPalette className="text-xl text-ui-secondary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-heading text-lg font-bold text-ui-text">
                    {t("config.ui.title")}
                  </h3>
                  <p className="mt-1 font-body text-sm font-medium text-ui-text-muted">
                    {t("config.ui.subtitle")}
                  </p>
                </div>
              </div>

              <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="flex w-full flex-col gap-3">
                  <h4 className="font-body text-xs font-semibold uppercase tracking-wider text-ui-text-muted">
                    {t("config.ui.theme")}
                  </h4>
                  <div className="flex w-full gap-2">
                    <ThemeOption
                      label={t("config.ui.themeLight")}
                      icon={<FiSun className="h-4 w-4" />}
                      active={theme === "light"}
                      onClick={() => setTheme("light")}
                    />
                    <ThemeOption
                      label={t("config.ui.themeDark")}
                      icon={<FiMoon className="h-4 w-4" />}
                      active={theme === "dark"}
                      onClick={() => setTheme("dark")}
                    />
                  </div>
                </div>

                <div className="flex w-full flex-col gap-3">
                  <h4 className="font-body text-xs font-semibold uppercase tracking-wider text-ui-text-muted">
                    {t("config.ui.language")}
                  </h4>
                  <div className="flex w-full items-center gap-3 rounded-full border-2 border-ui-border bg-ui-front px-4 py-1.5">
                    <span className="flex-1 font-body text-sm text-ui-text">Folderlan</span>
                    <LanguageSwitcher />
                  </div>
                </div>
              </div>
            </div>
          </FloatingContainer>
        </motion.div>

        {isOwner ? (
          <>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.2, 0, 0, 1], delay: 0.16 }}
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
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.2, 0, 0, 1], delay: 0.24 }}
              style={{ opacity: 0 }}
            >
              <LogsTable logs={logs} loading={loading} />
            </motion.div>

            {total > PAGE_SIZE && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: [0.2, 0, 0, 1], delay: 0.32 }}
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
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.2, 0, 0, 1], delay: 0.16 }}
            style={{ opacity: 0 }}
          >
            <FloatingContainer className="w-full !items-stretch border border-ui-border">
              <div className="flex w-full flex-col items-center gap-3 py-12 sm:flex-row sm:justify-center sm:py-10">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-ui-border-muted bg-ui-front">
                  <FaLock className="text-2xl text-ui-text-muted" />
                </div>
                <div className="flex flex-col items-center gap-1 text-center sm:items-start sm:text-left">
                  <p className="font-heading text-lg font-bold text-ui-text">
                    {t("config.logs.adminOnlyTitle")}
                  </p>
                  <p className="font-body text-sm text-ui-text-muted">
                    {t("config.logs.adminOnlyDesc")}
                  </p>
                </div>
              </div>
            </FloatingContainer>
          </motion.div>
        )}
      </div>
    </div>
  )
}

interface ThemeOptionProps {
  label: string
  icon: React.ReactNode
  active: boolean
  onClick: () => void
}

function ThemeOption({ label, icon, active, onClick }: ThemeOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "flex flex-1 items-center justify-center gap-2 rounded-full border-2 px-4 py-2 font-body text-sm font-semibold transition-all",
        active
          ? "bg-ui-primary/15 border-ui-primary text-ui-primary"
          : "border-ui-border bg-ui-front text-ui-text hover:border-ui-primary"
      )}
    >
      {icon}
      {label}
    </button>
  )
}
