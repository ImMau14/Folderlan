/**
 * DownloadPage — the main "Downloads" screen of the dashboard.
 *
 * Responsibilities:
 * - Fetches and paginates the file list from the API (25 files per page).
 * - Keeps local state for the current page, active filters and the set of
 *   files selected by the user.
 * - Exposes bulk actions (download, permissions, delete) through the
 *   floating ActionBar and opens the corresponding modals.
 *
 * All child components live in this folder and communicate exclusively
 * through props, so this page acts as the single source of truth.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"

import { useAuth } from "@auth/context/AuthContext"
import { useToast } from "@toast/context/ToastContext"
import { useI18n } from "@i18n/context/I18nContext"
import { useModal } from "@modal/context/ModalContext"
import ApiClient from "@shared/utils/ApiClient"
import type { FileItem } from "@shared/utils/ApiClient/types"
import { setPageName } from "@shared/utils/setPageName"

import FilterBar from "./FilterBar"
import FiltersModal from "./FiltersModal"
import FileGrid from "./FileGrid"
import ActionBar from "./ActionBar"
import DeleteModal from "./DeleteModal"
import PermissionModal from "./PermissionModal"
import Pagination from "../../components/Pagination"

const PAGE_SIZE = 25

/**
 * Filters applied to the file list. An empty string means "no filter" and
 * each value maps 1:1 to a query parameter of the list endpoint.
 */
export interface FileFilters {
  name: string
  min_size: string
  max_size: string
  start_date: string
  end_date: string
  visibility: string
  uploaded_by: string
}

export default function DownloadPage() {
  const { token, user } = useAuth()
  const { toast } = useToast()
  const { t } = useI18n()
  const { openComponent } = useModal()

  // The API client is created once per auth token; a new token yields a new client.
  const apiClient = useMemo(() => {
    const client = new ApiClient()
    if (token) client.setToken(token)
    return client
  }, [token])

  useEffect(() => {
    setPageName(t("menu.download"))
  }, [t])

  const [files, setFiles] = useState<FileItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const [fetchKey, setFetchKey] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [filters, setFilters] = useState<FileFilters>({
    name: "",
    min_size: "",
    max_size: "",
    start_date: "",
    end_date: "",
    visibility: "",
    uploaded_by: "",
  })
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const filtersRef = useRef(filters)
  filtersRef.current = filters

  // Reset to the first page and force a refetch of the current list.
  const refreshList = useCallback(() => {
    setOffset(0)
    setFetchKey((k) => k + 1)
  }, [])

  /**
   * Fetches one page of files from the API and stores both the rows and the
   * total count. Only filters with an actual value are sent as query params.
   */
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
      if (f.visibility) params.visibility = f.visibility
      if (f.uploaded_by) params.uploaded_by = Number(f.uploaded_by)

      const result = await apiClient.listFiles(params)
      if (result.success && result.data.data) {
        const data = result.data.data
        setFiles(data.items ?? [])
        setTotal(data.total ?? 0)
      } else {
        toast({ type: "error", title: t("download.toast.fetchError"), duration: 4000 })
      }
      setLoading(false)
    },
    [apiClient, toast, t]
  )

  // Refetch whenever the page changes or something requests a refresh.
  useEffect(() => {
    fetchFiles(offset, filtersRef.current)
  }, [offset, fetchKey, fetchFiles])

  // Debounce the search input: wait until the user stops typing before refetching.
  const handleNameSearch = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, name: value }))
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      setOffset(0)
      setFetchKey((k) => k + 1)
    }, 400)
  }, [])

  // Count of active filters (everything except the search box).
  const activeFilterCount = useMemo(() => {
    const { name: _name, ...rest } = filters
    return Object.values(rest).filter((v) => v !== "").length
  }, [filters])

  // A file can be managed (delete, share, toggle public) when the caller has
  // collaborator or owner access on it. Falls back to the role if the backend
  // does not send `my_access` yet.
  const canManageFile = useCallback(
    (file: FileItem) => {
      const level = file.my_access ?? (user?.role === "owner" ? "owner" : "viewer")
      return level === "owner" || level === "collaborator"
    },
    [user?.role]
  )

  // Bulk management actions are only offered when EVERY selected file supports
  // them, so the buttons never lead to partial 403 errors.
  const selectedCanManage = useMemo(() => {
    const selected = files.filter((f) => selectedIds.has(f.id))
    return selected.length > 0 && selected.every(canManageFile)
  }, [files, selectedIds, canManageFile])

  // Open the filters modal; applying new filters resets pagination and refetches.
  const handleOpenFilters = useCallback(() => {
    openComponent(FiltersModal, {
      filters,
      apiClient,
      onApply: (next) => {
        setFilters(next)
        setOffset(0)
        setFetchKey((k) => k + 1)
      },
    })
  }, [openComponent, filters, apiClient])

  // Toggle a file in/out of the current selection.
  const handleSelectFile = useCallback((file: FileItem) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(file.id)) {
        next.delete(file.id)
      } else {
        next.add(file.id)
      }
      return next
    })
  }, [])

  /**
   * Download a single file: fetch its blob, create a temporary anchor element
   * and click it so the browser starts the download.
   */
  const handleDoubleClick = useCallback(
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

  // Flip a single file's visibility and update the row in place.
  const handleToggleVisibility = useCallback(
    async (file: FileItem) => {
      const newValue = !file.is_public
      const result = await apiClient.toggleFilePublic(file.id, newValue)
      if (result.success) {
        setFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, is_public: newValue } : f)))
        toast({
          type: "success",
          title: newValue ? t("download.toast.madePublic") : t("download.toast.madePrivate"),
          duration: 2500,
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

  // Download every selected file sequentially to avoid flooding the server.
  const handleDownloadSelected = useCallback(async () => {
    if (selectedIds.size === 0) return
    for (const fileId of selectedIds) {
      const file = files.find((f) => f.id === fileId)
      if (file) {
        await handleDoubleClick(file)
      }
    }
  }, [selectedIds, files, handleDoubleClick])

  // Re-fetch the current page without resetting pagination (used by modals).
  const refetchCurrent = useCallback(() => {
    setFetchKey((key) => key + 1)
  }, [])

  /**
   * Derives the initial visibility state for the selected files so the
   * permissions modal can preselect the matching button:
   * - all selected files public   -> true
   * - all selected files private  -> false
   * - a combination of both       -> "mixed"
   * - selection unknown to the list -> undefined (no button preselected)
   */
  const initialVisibility = useMemo(() => {
    const selected = files.filter((f) => selectedIds.has(f.id))
    if (selected.length === 0) return undefined
    const publicCount = selected.filter((f) => f.is_public).length
    if (publicCount === 0) return false
    if (publicCount === selected.length) return true
    return "mixed"
  }, [files, selectedIds])

  // Open the permissions modal for all selected files.
  const handleVisibilitySelected = useCallback(() => {
    if (selectedIds.size === 0) return
    openComponent(PermissionModal, {
      fileIds: Array.from(selectedIds),
      apiClient,
      initialVisibility,
      canManage: selectedCanManage,
      onRefresh: refetchCurrent,
    })
  }, [selectedIds, openComponent, apiClient, initialVisibility, selectedCanManage, refetchCurrent])

  // Open the delete confirmation modal for all selected files.
  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return
    openComponent(DeleteModal, {
      fileIds: Array.from(selectedIds),
      apiClient,
      onRefresh: refreshList,
    })
  }, [selectedIds, openComponent, apiClient, refreshList])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const currentPage = useMemo(() => Math.floor(offset / PAGE_SIZE) + 1, [offset])
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total])

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

  const handlePrevPage = useCallback(() => {
    setOffset((prev) => Math.max(0, prev - PAGE_SIZE))
    clearSelection()
    scrollToTop()
  }, [clearSelection, scrollToTop])

  const handleNextPage = useCallback(() => {
    setOffset((prev) => Math.min(Math.max(0, total - 1), prev + PAGE_SIZE))
    clearSelection()
    scrollToTop()
  }, [total, clearSelection, scrollToTop])

  // Clear the selection when clicking anywhere outside the cards, the
  // floating action bar or an open modal.
  useEffect(() => {
    const onDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (
        target.closest("[data-file-card]") ||
        target.closest("[data-action-bar]") ||
        target.closest("[data-modal]")
      ) {
        return
      }
      setSelectedIds((prev) => (prev.size > 0 ? new Set() : prev))
    }
    document.addEventListener("click", onDocumentClick)
    return () => document.removeEventListener("click", onDocumentClick)
  }, [])

  return (
    <div
      ref={scrollRef}
      className="flex h-full flex-col overflow-y-auto bg-ui-back scrollbar scrollbar-thin"
    >
      {/* Toolbar: search + filters trigger */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
        style={{ opacity: 0 }}
      >
        <FilterBar
          filters={filters}
          onNameSearch={handleNameSearch}
          onOpenFilters={handleOpenFilters}
          activeFilterCount={activeFilterCount}
        />
      </motion.div>

      {/* Content: file grid + pagination */}
      {/*
        Constant bottom clearance on mobile (pb-28) so the fixed nav / floating
        action bar overlay content without changing the scroll container's height,
        which would otherwise cause a scroll jump when the selection toggles.
      */}
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 p-4 pb-28 sm:p-6 sm:pb-0 lg:p-8">
        <FileGrid
          files={files}
          loading={loading}
          selectedIds={selectedIds}
          onSelect={handleSelectFile}
          onDoubleClick={handleDoubleClick}
          onToggleVisibility={handleToggleVisibility}
        />

        {files.length > 0 && (
          <Pagination
            total={total}
            offset={offset}
            pageSize={PAGE_SIZE}
            currentPage={currentPage}
            totalPages={totalPages}
            onPrevPage={handlePrevPage}
            onNextPage={handleNextPage}
          />
        )}
      </div>

      {/* Floating bulk actions (only when files are selected) */}
      <ActionBar
        selectedCount={selectedIds.size}
        canManage={selectedCanManage}
        onDownload={handleDownloadSelected}
        onVisibility={handleVisibilitySelected}
        onDelete={handleDeleteSelected}
        onClear={clearSelection}
      />
    </div>
  )
}
