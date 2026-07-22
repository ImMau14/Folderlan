import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"

import { useAuth } from "@auth/context/AuthContext"
import { useToast } from "@toast/context/ToastContext"
import { useI18n } from "@i18n/context/I18nContext"
import ApiClient from "@shared/utils/ApiClient"
import type { FileItem, FilePermission, User } from "@shared/utils/ApiClient/types"

import SearchBar from "./SearchBar"
import FileTable from "./FileTable"
import Pagination from "./Pagination"
import DeleteModal from "./DeleteModal"
import PermissionModal from "./PermissionModal"

const PAGE_SIZE = 25

export interface FileFilters {
  name: string
  min_size: string
  max_size: string
  start_date: string
  end_date: string
}

export default function DownloadPage() {
  const { token } = useAuth()
  const { toast } = useToast()
  const { t } = useI18n()

  const apiClient = useMemo(() => {
    const client = new ApiClient()
    if (token) client.setToken(token)
    return client
  }, [token])

  const [files, setFiles] = useState<FileItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const [fetchKey, setFetchKey] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<FileFilters>({
    name: "",
    min_size: "",
    max_size: "",
    start_date: "",
    end_date: "",
  })
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const [permModal, setPermModal] = useState<{
    open: boolean
    fileId: number | null
    fileName: string
  }>({ open: false, fileId: null, fileName: "" })
  const [permissions, setPermissions] = useState<FilePermission[]>([])
  const [loadingPerms, setLoadingPerms] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [grantUserId, setGrantUserId] = useState("")
  const [grantLevel, setGrantLevel] = useState<"viewer" | "collaborator">("viewer")

  const [deleteModal, setDeleteModal] = useState<{
    open: boolean
    fileId: number | null
    fileName: string
  }>({ open: false, fileId: null, fileName: "" })
  const [deleting, setDeleting] = useState(false)

  const fetchFiles = useCallback(
    async (off: number, f: FileFilters) => {
      setLoading(true)
      const params: Record<string, string | number> = {
        limit: PAGE_SIZE,
        offset: off,
      }
      if (f.name) params.name = f.name
      if (f.min_size) params.min_size = Number(f.min_size)
      if (f.max_size) params.max_size = Number(f.max_size)
      if (f.start_date) params.start_date = f.start_date
      if (f.end_date) params.end_date = f.end_date

      const result = await apiClient.listFiles(params)
      if (result.success && result.data.data) {
        const data = result.data.data
        setFiles(data.items ?? [])
        setTotal(data.total)
      } else {
        toast({ type: "error", title: t("download.toast.fetchError"), duration: 4000 })
      }
      setLoading(false)
    },
    [apiClient, toast, t]
  )

  useEffect(() => {
    fetchFiles(offset, filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, fetchKey, fetchFiles])

  const handleFilterChange = useCallback((key: keyof FileFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleNameSearch = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, name: value }))
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      setOffset(0)
      setFetchKey((k) => k + 1)
    }, 400)
  }, [])

  const applyFilters = useCallback(() => {
    setOffset(0)
    setFetchKey((k) => k + 1)
  }, [])

  const clearFilters = useCallback(() => {
    setFilters({ name: "", min_size: "", max_size: "", start_date: "", end_date: "" })
    setOffset(0)
    setFetchKey((k) => k + 1)
  }, [])

  const handleDownload = useCallback(
    async (file: FileItem) => {
      const result = await apiClient.downloadFile(file.id)
      if (result.success) {
        const url = URL.createObjectURL(result.data.blob)
        const a = document.createElement("a")
        a.href = url
        a.download = result.data.filename ?? file.name
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        toast({
          type: "success",
          title: t("download.toast.downloaded"),
          description: t("download.toast.downloadedDesc", { name: file.name }),
          duration: 3000,
        })
      } else {
        toast({
          type: "error",
          title: t("download.toast.fetchError"),
          description: result.error.message,
          duration: 4000,
        })
      }
    },
    [apiClient, toast, t]
  )

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteModal.fileId) return
    setDeleting(true)
    const result = await apiClient.deleteFile(deleteModal.fileId)
    if (result.success) {
      toast({
        type: "success",
        title: t("download.toast.deleteSuccess"),
        description: t("download.toast.deleteSuccessDesc", { name: deleteModal.fileName }),
        duration: 3000,
      })
      setFiles((prev) => prev.filter((f) => f.id !== deleteModal.fileId))
      setTotal((prev) => prev - 1)
    } else {
      toast({
        type: "error",
        title: t("download.toast.deleteError"),
        description: result.error.message,
        duration: 4000,
      })
    }
    setDeleting(false)
    setDeleteModal({ open: false, fileId: null, fileName: "" })
  }, [deleteModal, apiClient, toast, t])

  const openPermModal = useCallback(
    async (file: FileItem) => {
      setPermModal({ open: true, fileId: file.id, fileName: file.name })
      setGrantUserId("")
      setGrantLevel("viewer")
      setLoadingPerms(true)
      const [permsResult, usersResult] = await Promise.all([
        apiClient.listFilePerms(file.id),
        apiClient.getUsers({ limit: 200 }),
      ])
      if (permsResult.success) {
        setPermissions(permsResult.data.data ?? [])
      } else {
        toast({ type: "error", title: t("download.toast.permListError"), duration: 4000 })
        setPermissions([])
      }
      if (usersResult.success) {
        setUsers(usersResult.data.data?.items ?? [])
      }
      setLoadingPerms(false)
    },
    [apiClient, toast, t]
  )

  const closePermModal = useCallback(() => {
    setPermModal({ open: false, fileId: null, fileName: "" })
    setPermissions([])
  }, [])

  const handleGrant = useCallback(async () => {
    if (!permModal.fileId || !grantUserId) return
    const userId = Number(grantUserId)
    if (Number.isNaN(userId)) return

    const result = await apiClient.grantFilePerms(permModal.fileId, {
      user_id: userId,
      access_level: grantLevel,
    })
    if (result.success) {
      toast({
        type: "success",
        title: t("download.toast.permGranted"),
        description: t("download.toast.permGrantedDesc", { level: grantLevel }),
        duration: 3000,
      })
      setGrantUserId("")
      const permsResult = await apiClient.listFilePerms(permModal.fileId)
      if (permsResult.success) setPermissions(permsResult.data.data ?? [])
    } else {
      toast({
        type: "error",
        title: t("download.toast.permListError"),
        description: result.error.message,
        duration: 4000,
      })
    }
  }, [permModal.fileId, grantUserId, grantLevel, apiClient, toast, t])

  const handleRevoke = useCallback(
    async (userId: number) => {
      if (!permModal.fileId) return
      const result = await apiClient.revokeFilePerm(permModal.fileId, userId)
      if (result.success) {
        toast({ type: "success", title: t("download.toast.permRevoked"), duration: 3000 })
        setPermissions((prev) => prev.filter((p) => p.user_id !== userId))
      } else {
        toast({
          type: "error",
          title: t("download.toast.permListError"),
          description: result.error.message,
          duration: 4000,
        })
      }
    },
    [permModal.fileId, apiClient, toast, t]
  )

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6 scrollbar scrollbar-thin scrollbar-thumb-ui-border scrollbar-track-transparent">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
        style={{ opacity: 0 }}
      >
        <SearchBar
          filters={filters}
          showFilters={showFilters}
          onToggleFilters={() => setShowFilters((s) => !s)}
          onNameSearch={handleNameSearch}
          onFilterChange={handleFilterChange}
          onApplyFilters={applyFilters}
          onClearFilters={clearFilters}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.2, 0, 0, 1], delay: 0.12 }}
        style={{ opacity: 0 }}
      >
        <FileTable
          files={files}
          loading={loading}
          onDownload={handleDownload}
          onOpenPermModal={openPermModal}
          onOpenDeleteModal={(file) =>
            setDeleteModal({ open: true, fileId: file.id, fileName: file.name })
          }
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

      <DeleteModal
        open={deleteModal.open}
        fileName={deleteModal.fileName}
        deleting={deleting}
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteModal({ open: false, fileId: null, fileName: "" })}
      />

      <PermissionModal
        open={permModal.open}
        fileName={permModal.fileName}
        permissions={permissions}
        users={users}
        loadingPerms={loadingPerms}
        grantUserId={grantUserId}
        grantLevel={grantLevel}
        onGrantUserIdChange={setGrantUserId}
        onGrantLevelChange={setGrantLevel}
        onGrant={handleGrant}
        onRevoke={handleRevoke}
        onClose={closePermModal}
      />
    </div>
  )
}
