/**
 * DeleteModal — confirmation dialog for deleting one or multiple files.
 *
 * Accepts either a single file (fileId/fileName) or a batch (fileIds).
 * Deletes each target sequentially and reports the outcome via toasts,
 * then refreshes the list and closes itself.
 */
import { useState, useCallback, useMemo } from "react"
import { FaTriangleExclamation, FaTrash } from "react-icons/fa6"

import { useI18n } from "@i18n/context/I18nContext"
import { useToast } from "@toast/context/ToastContext"
import { useModal } from "@modal/context/ModalContext"
import ApiClient from "@shared/utils/ApiClient"

interface DeleteModalProps {
  fileId?: number
  fileName?: string
  fileIds?: number[]
  apiClient: ApiClient
  onRefresh: () => void
}

export default function DeleteModal({
  fileId,
  fileName,
  fileIds,
  apiClient,
  onRefresh,
}: DeleteModalProps) {
  const { t } = useI18n()
  const { toast } = useToast()
  const { close } = useModal()

  const [deleting, setDeleting] = useState(false)

  // Normalise the props: work with a list of ids whether it's one file or many.
  const idsToDelete = useMemo(() => fileIds ?? (fileId ? [fileId] : []), [fileIds, fileId])
  const displayName = useMemo(
    () => fileName ?? t("download.delete.multiName", { count: idsToDelete.length }),
    [fileName, idsToDelete.length, t]
  )

  /**
   * Deletes every target file one by one and reports the outcome with toasts.
   * The modal closes automatically once the operation finishes.
   */
  const handleConfirm = useCallback(async () => {
    if (deleting || idsToDelete.length === 0) return
    setDeleting(true)

    let successCount = 0
    let failCount = 0

    for (const id of idsToDelete) {
      const result = await apiClient.deleteFile(id)
      if (result.success) {
        successCount++
      } else {
        failCount++
      }
    }

    if (successCount > 0) {
      toast({
        type: "success",
        title: t("download.toast.deleteSuccess"),
        description: t("download.toast.deleteSuccessDesc", { name: displayName }),
        duration: 3000,
      })
    }
    if (failCount > 0) {
      toast({
        type: "error",
        title: t("download.toast.deleteError"),
        description: t("download.toast.operationFailed", { count: failCount }),
        duration: 4000,
      })
    }

    onRefresh()
    close()
    setDeleting(false)
  }, [deleting, idsToDelete, displayName, apiClient, toast, t, onRefresh, close])

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Header: warning icon + target name */}
      <div className="flex items-center gap-4 border-b border-ui-border pb-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-ui-border bg-ui-danger/10 shadow-sm">
          <FaTriangleExclamation className="text-2xl text-ui-danger" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-heading text-xl font-bold text-ui-text">
            {t("download.delete.title")}
          </h3>
          <p className="mt-1 break-words font-body text-sm font-medium text-ui-text-muted">
            {t("download.delete.confirm", { name: displayName })}
          </p>
        </div>
      </div>

      {/* Footer: cancel + confirm */}
      <div className="mt-2 flex w-full gap-3">
        <button
          onClick={close}
          disabled={deleting}
          className="flex flex-1 items-center justify-center rounded-full border-2 border-ui-border bg-ui-front px-4 py-2.5 font-body text-sm font-semibold text-ui-text transition-all hover:border-ui-primary disabled:opacity-50"
        >
          {t("download.delete.cancel")}
        </button>
        <button
          onClick={handleConfirm}
          disabled={deleting}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-ui-danger px-4 py-2.5 font-body text-sm font-semibold text-white transition-all hover:bg-ui-danger-hover disabled:pointer-events-none disabled:opacity-50 dark:text-ui-base"
        >
          {/* Spinner while the deletion is in flight */}
          {deleting ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <FaTrash className="h-4 w-4" />
          )}
          {t("download.delete.confirmButton")}
        </button>
      </div>
    </div>
  )
}
