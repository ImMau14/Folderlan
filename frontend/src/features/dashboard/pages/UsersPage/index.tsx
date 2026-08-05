import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import { FaMagnifyingGlass, FaUserPlus, FaUsers } from "react-icons/fa6"

import { useAuth } from "@auth/context/AuthContext"
import { useToast } from "@toast/context/ToastContext"
import { useI18n } from "@i18n/context/I18nContext"
import { useModal } from "@modal/context/ModalContext"
import ApiClient from "@shared/utils/ApiClient"
import Input from "@shared/components/Input"
import Select from "@shared/components/Select"
import type { User } from "@shared/utils/ApiClient/types"
import { setPageName } from "@shared/utils/setPageName"
import FloatingContainer from "../../components/FloatingContainer"
import Pagination from "../../components/Pagination"
import UserTable from "./UserTable"
import PermsModal from "./PermsModal"
import DeleteModal from "./DeleteModal"
import CreateUserModal from "./CreateUserModal"

const PAGE_SIZE = 10

type StatusFilter = "" | "active" | "inactive"
type PermFilter =
  | ""
  | "can_upload"
  | "can_upload:false"
  | "can_delete_own_files"
  | "can_delete_own_files:false"

export default function UsersPage() {
  const { token } = useAuth()
  const { toast } = useToast()
  const { t } = useI18n()
  const { openComponent } = useModal()

  const apiClient = useMemo(() => {
    const client = new ApiClient()
    if (token) client.setToken(token)
    return client
  }, [token])

  const [users, setUsers] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const [fetchKey, setFetchKey] = useState(0)
  const [name, setName] = useState("")
  const [status, setStatus] = useState<StatusFilter>("")
  const [perm, setPerm] = useState<PermFilter>("")
  const [busyId, setBusyId] = useState<number | null>(null)

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const nameRef = useRef(name)
  nameRef.current = name
  const statusRef = useRef(status)
  statusRef.current = status
  const permRef = useRef(perm)
  permRef.current = perm

  const fetchUsers = useCallback(
    async (off: number) => {
      setLoading(true)
      const params: Record<string, string | number | boolean> = {
        limit: PAGE_SIZE,
        offset: off,
      }
      if (nameRef.current) params.name = nameRef.current
      if (statusRef.current) params.is_active = statusRef.current === "active"
      if (permRef.current) params.perm = permRef.current

      const result = await apiClient.getUsers(params)
      if (result.success && result.data.data) {
        setUsers(result.data.data.items ?? [])
        setTotal(result.data.data.total ?? 0)
      } else {
        toast({
          type: "error",
          title: t("users.toast.fetchError"),
          description: t("users.toast.fetchErrorDesc"),
          duration: 4000,
        })
      }
      setLoading(false)
    },
    [apiClient, toast, t]
  )

  useEffect(() => {
    fetchUsers(offset)
  }, [offset, fetchKey, fetchUsers])

  const refreshList = useCallback(() => {
    setOffset(0)
    setFetchKey((k) => k + 1)
  }, [])

  const handleNameSearch = useCallback((value: string) => {
    setName(value)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      setOffset(0)
      setFetchKey((k) => k + 1)
    }, 400)
  }, [])

  const handleStatusChange = useCallback((value: StatusFilter) => {
    setStatus(value)
    setOffset(0)
    setFetchKey((k) => k + 1)
  }, [])

  const handlePermChange = useCallback((value: PermFilter) => {
    setPerm(value)
    setOffset(0)
    setFetchKey((k) => k + 1)
  }, [])

  const handleToggle = useCallback(
    async (user: User) => {
      if (user.role === "owner" || busyId === user.id) return
      setBusyId(user.id)
      const result = await apiClient.toggleUser(user.id)
      if (result.success) {
        toast({
          type: "success",
          title: t("users.toast.toggleSuccess"),
          description: t("users.toast.toggleSuccessDesc", { name: user.username }),
          duration: 3000,
        })
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, is_active: !u.is_active } : u))
        )
      } else {
        toast({
          type: "error",
          title: t("users.toast.toggleError"),
          description: result.error.message,
          duration: 4000,
        })
      }
      setBusyId(null)
    },
    [busyId, apiClient, toast, t]
  )

  const openPermsModal = useCallback(
    (user: User) => {
      openComponent(PermsModal, { user, apiClient, onRefresh: refreshList })
    },
    [openComponent, apiClient, refreshList]
  )

  const openDeleteModal = useCallback(
    (user: User) => {
      openComponent(DeleteModal, { user, apiClient, onRefresh: refreshList })
    },
    [openComponent, apiClient, refreshList]
  )

  const openCreateUserModal = useCallback(() => {
    openComponent(CreateUserModal, { apiClient, onSuccess: refreshList })
  }, [openComponent, apiClient, refreshList])

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  useEffect(() => {
    setPageName(t("menu.users"))
  }, [t])

  return (
    <div className="flex h-full flex-col overflow-y-auto scrollbar scrollbar-thin scrollbar-thumb-ui-border scrollbar-track-transparent">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 sm:gap-6 sm:p-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
          style={{ opacity: 0 }}
        >
          <FloatingContainer className="w-full !items-stretch border border-ui-border !p-5 sm:!p-6">
            <div className="flex w-full flex-col gap-4">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-ui-border-muted bg-ui-front">
                  <FaUsers className="text-xl text-ui-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-heading text-xl font-bold tracking-tight text-ui-text">
                    {t("menu.users")}
                  </h2>
                  <p className="mt-1 font-body text-sm font-medium text-ui-text-muted">
                    {t("users.subtitle")}
                  </p>
                </div>
                <motion.button
                  onClick={openCreateUserModal}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
                  className="flex shrink-0 cursor-pointer items-center gap-2 rounded-full bg-ui-primary px-4 py-2 font-body text-sm font-semibold text-ui-highlight transition-colors hover:bg-ui-primary-hover dark:text-ui-base"
                >
                  <FaUserPlus className="text-sm" />
                  {t("users.createUser.button")}
                </motion.button>
              </div>

              <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <FaMagnifyingGlass className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-sm text-ui-text-muted" />
                  <Input
                    value={name}
                    onChange={(e) => handleNameSearch(e.target.value)}
                    placeholder={t("users.search.placeholder")}
                    className="pl-11"
                  />
                </div>
                <Select
                  value={status}
                  onChange={(v) => handleStatusChange(v as StatusFilter)}
                  placeholder={t("users.filters.all")}
                  options={[
                    { value: "", label: t("users.filters.all") },
                    { value: "active", label: t("users.filters.active") },
                    { value: "inactive", label: t("users.filters.inactive") },
                  ]}
                  className="sm:w-44"
                />
                <Select
                  value={perm}
                  onChange={(v) => handlePermChange(v as PermFilter)}
                  placeholder={t("users.permFilters.allPerms")}
                  options={[
                    { value: "", label: t("users.permFilters.allPerms") },
                    { value: "can_upload", label: t("users.permFilters.canUpload") },
                    { value: "can_upload:false", label: t("users.permFilters.noUpload") },
                    { value: "can_delete_own_files", label: t("users.permFilters.canDelete") },
                    { value: "can_delete_own_files:false", label: t("users.permFilters.noDelete") },
                  ]}
                  className="sm:w-48"
                />
              </div>
            </div>
          </FloatingContainer>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.2, 0, 0, 1], delay: 0.12 }}
          style={{ opacity: 0 }}
        >
          <UserTable
            users={users}
            loading={loading}
            busyId={busyId}
            onToggle={handleToggle}
            onEditPerms={openPermsModal}
            onDelete={openDeleteModal}
          />
        </motion.div>

        {total > PAGE_SIZE && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.2, 0, 0, 1], delay: 0.2 }}
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
      </div>
    </div>
  )
}
