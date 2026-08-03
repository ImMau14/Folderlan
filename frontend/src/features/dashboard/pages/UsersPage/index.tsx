import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import { FaMagnifyingGlass, FaUsers } from "react-icons/fa6"

import { useAuth } from "@auth/context/AuthContext"
import { useToast } from "@toast/context/ToastContext"
import { useI18n } from "@i18n/context/I18nContext"
import ApiClient from "@shared/utils/ApiClient"
import Input from "@shared/components/Input"
import type { User } from "@shared/utils/ApiClient/types"
import FloatingContainer from "../../components/FloatingContainer"
import Pagination from "../../components/Pagination"
import UserTable from "./UserTable"
import PermsModal, { type PermsForm } from "./PermsModal"
import DeleteModal from "./DeleteModal"

const PAGE_SIZE = 10

type StatusFilter = "" | "active" | "inactive"

const emptyPermsForm: PermsForm = {
  can_upload: false,
  can_delete_own_files: false,
  has_upload_limits: false,
  upload_limit: "",
}

function formFromUser(user: User): PermsForm {
  return {
    can_upload: user.can_upload,
    can_delete_own_files: user.can_delete_own_files,
    has_upload_limits: user.has_upload_limits,
    upload_limit: user.upload_limit > 0 ? String(user.upload_limit) : "",
  }
}

export default function UsersPage() {
  const { token } = useAuth()
  const { toast } = useToast()
  const { t } = useI18n()

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
  const [busyId, setBusyId] = useState<number | null>(null)

  const [permsModal, setPermsModal] = useState<{ open: boolean; user: User | null }>({
    open: false,
    user: null,
  })
  const [permsForm, setPermsForm] = useState<PermsForm>(emptyPermsForm)
  const [savingPerms, setSavingPerms] = useState(false)

  const [deleteModal, setDeleteModal] = useState<{ open: boolean; user: User | null }>({
    open: false,
    user: null,
  })
  const [deleting, setDeleting] = useState(false)

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const nameRef = useRef(name)
  nameRef.current = name
  const statusRef = useRef(status)
  statusRef.current = status

  const fetchUsers = useCallback(
    async (off: number) => {
      setLoading(true)
      const params: Record<string, string | number | boolean> = {
        limit: PAGE_SIZE,
        offset: off,
      }
      if (nameRef.current) params.name = nameRef.current
      if (statusRef.current) params.is_active = statusRef.current === "active"

      const result = await apiClient.getUsers(params)
      if (result.success && result.data.data) {
        setUsers(result.data.data.items ?? [])
        setTotal(result.data.data.total ?? 0)
      } else {
        toast({ type: "error", title: t("users.toast.fetchError"), duration: 4000 })
      }
      setLoading(false)
    },
    [apiClient, toast, t]
  )

  useEffect(() => {
    fetchUsers(offset)
  }, [offset, fetchKey, fetchUsers])

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

  const openPermsModal = useCallback((user: User) => {
    setPermsForm(formFromUser(user))
    setPermsModal({ open: true, user })
  }, [])

  const closePermsModal = useCallback(() => {
    setPermsModal({ open: false, user: null })
  }, [])

  const handleSavePerms = useCallback(async () => {
    const user = permsModal.user
    if (!user || savingPerms) return

    let uploadLimit: number | undefined
    if (permsForm.has_upload_limits) {
      uploadLimit = Number(permsForm.upload_limit)
      if (!Number.isFinite(uploadLimit) || uploadLimit < 0) {
        toast({ type: "error", title: t("users.toast.invalidLimit"), duration: 4000 })
        return
      }
    }

    setSavingPerms(true)
    const result = await apiClient.updateUserPerms(user.id, {
      can_upload: permsForm.can_upload,
      can_delete_own_files: permsForm.can_delete_own_files,
      has_upload_limits: permsForm.has_upload_limits,
      ...(uploadLimit !== undefined ? { upload_limit: uploadLimit } : {}),
    })
    if (result.success) {
      toast({
        type: "success",
        title: t("users.toast.permsSuccess"),
        description: t("users.toast.permsSuccessDesc", { name: user.username }),
        duration: 3000,
      })
      closePermsModal()
      setFetchKey((k) => k + 1)
    } else {
      toast({
        type: "error",
        title: t("users.toast.permsError"),
        description: result.error.message,
        duration: 4000,
      })
    }
    setSavingPerms(false)
  }, [permsModal.user, permsForm, savingPerms, apiClient, toast, t, closePermsModal])

  const handleDeleteConfirm = useCallback(async () => {
    const user = deleteModal.user
    if (!user || deleting) return
    setDeleting(true)
    const result = await apiClient.deleteUser(user.id)
    if (result.success) {
      toast({
        type: "success",
        title: t("users.toast.deleteSuccess"),
        description: t("users.toast.deleteSuccessDesc", { name: user.username }),
        duration: 3000,
      })
      setUsers((prev) => prev.filter((u) => u.id !== user.id))
      setTotal((prev) => Math.max(0, prev - 1))
    } else {
      toast({
        type: "error",
        title: t("users.toast.deleteError"),
        description: result.error.message,
        duration: 4000,
      })
    }
    setDeleting(false)
    setDeleteModal({ open: false, user: null })
  }, [deleteModal.user, deleting, apiClient, toast, t])

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
                <select
                  value={status}
                  onChange={(e) => handleStatusChange(e.target.value as StatusFilter)}
                  className="rounded-full border-2 border-ui-border bg-ui-front px-3 py-2 font-body text-sm text-ui-text transition-colors focus:border-ui-primary focus:outline-none focus:ring-2 focus:ring-ui-primary sm:w-44"
                >
                  <option value="">{t("users.filters.all")}</option>
                  <option value="active">{t("users.filters.active")}</option>
                  <option value="inactive">{t("users.filters.inactive")}</option>
                </select>
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
            onDelete={(user) => setDeleteModal({ open: true, user })}
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

        <PermsModal
          open={permsModal.open}
          user={permsModal.user}
          form={permsForm}
          saving={savingPerms}
          onFormChange={setPermsForm}
          onSave={handleSavePerms}
          onClose={closePermsModal}
        />

        <DeleteModal
          open={deleteModal.open}
          user={deleteModal.user}
          deleting={deleting}
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeleteModal({ open: false, user: null })}
        />
      </div>
    </div>
  )
}
