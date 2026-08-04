import { useState, useCallback, useMemo } from "react"
import { FaTriangleExclamation } from "react-icons/fa6"
import { IoClose } from "react-icons/io5"

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

  const idsToDelete = useMemo(() => fileIds ?? (fileId ? [fileId] : []), [fileIds, fileId])
  const displayName = useMemo(
    () => fileName ?? `${idsToDelete.length} file(s)`,
    [fileName, idsToDelete.length]
  )

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
        description: `Failed to delete ${failCount} file(s)`,
        duration: 4000,
      })
    }

    onRefresh()
    close()
    setDeleting(false)
  }, [deleting, idsToDelete, displayName, apiClient, toast, t, onRefresh, close])

  return (
    <div className="flex w-full flex-col gap-6">
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

      <div className="mt-2 flex w-full gap-3">
        <button
          onClick={close}
          disabled={deleting}
          className="btn-glass flex-1 !py-3 backdrop-blur-md"
        >
          {t("download.delete.cancel")}
        </button>
        <button
          onClick={handleConfirm}
          disabled={deleting}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-ui-danger px-4 py-3 font-heading text-sm font-bold text-white shadow-ui transition-all hover:-translate-y-0.5 hover:bg-ui-danger-hover hover:shadow-2ui disabled:pointer-events-none disabled:opacity-50"
        >
          {deleting ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <IoClose className="text-lg" />
          )}
          {t("download.delete.confirmButton")}
        </button>
      </div>
    </div>
  )
}
