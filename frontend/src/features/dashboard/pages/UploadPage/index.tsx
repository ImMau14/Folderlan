/**
 * File upload page with responsive design.
 * On mobile it stacks sections; on desktop it shows them side by side.
 */

import { useCallback, useMemo, useRef, useState, type FC } from "react"
import type { CancelTokenSource } from "axios"

import { useAuth } from "@auth/context/AuthContext"
import { useToast } from "@toast/context/ToastContext"
import { useI18n } from "@i18n/context/I18nContext"
import ApiClient from "@shared/utils/ApiClient"
import formatBytes from "@shared/utils/formatBytes"

import DropZone from "./DropZone"
import FileQueue, { type UploadQueueItem } from "./FileQueue"

const getFileKey = (file: File) => `${file.name}-${file.size}-${file.lastModified}`

const createQueueItem = (file: File): UploadQueueItem => ({
  key: getFileKey(file),
  file,
  progress: 0,
  status: "idle",
})

export const UploadPage: FC = () => {
  const { token } = useAuth()
  const { toast } = useToast()
  const { t } = useI18n()
  const cancelTokenMap = useRef<Record<string, CancelTokenSource | null>>({})
  const [files, setFiles] = useState<UploadQueueItem[]>([])

  const apiClient = useMemo(() => {
    const client = new ApiClient()
    if (token) client.setToken(token)
    return client
  }, [token])

  const addFiles = useCallback((incomingFiles: File[]) => {
    setFiles((currentFiles) => {
      const nextFiles = [...currentFiles]
      for (const file of incomingFiles) {
        const key = getFileKey(file)
        if (!nextFiles.some((item) => item.key === key)) {
          nextFiles.push(createQueueItem(file))
        }
      }
      return nextFiles
    })
  }, [])

  const updateFile = useCallback((key: string, patch: Partial<UploadQueueItem>) => {
    setFiles((currentFiles) =>
      currentFiles.map((item) => (item.key === key ? { ...item, ...patch } : item))
    )
  }, [])

  const removeFile = useCallback((key: string) => {
    const source = cancelTokenMap.current[key]
    if (source) {
      source.cancel("Upload cancelled by user")
      delete cancelTokenMap.current[key]
    }
    setFiles((currentFiles) => currentFiles.filter((item) => item.key !== key))
  }, [])

  const pauseUpload = useCallback(
    (key: string) => {
      const source = cancelTokenMap.current[key]
      if (source) {
        source.cancel("Upload paused by user")
        delete cancelTokenMap.current[key]
      }
      updateFile(key, { status: "paused" })
    },
    [updateFile]
  )

  const uploadOneFile = useCallback(
    async (key: string) => {
      const item = files.find((file) => file.key === key)
      if (!item) return

      if (!token) {
        toast({
          type: "error",
          title: t("upload.toast.authRequired"),
          description: t("upload.toast.authRequiredDesc"),
          duration: 4000,
        })
        updateFile(key, { status: "idle" })
        return
      }

      const source = apiClient.createCancelToken()
      cancelTokenMap.current[key] = source
      updateFile(key, { status: "uploading", progress: 0, error: undefined })

      const result = await apiClient.uploadFile(item.file, {
        cancelToken: source.token,
        onUploadProgress: (event) => {
          if (!event.total) return
          updateFile(key, {
            progress: Math.round((event.loaded / event.total) * 100),
          })
        },
      })

      delete cancelTokenMap.current[key]

      if (result.success) {
        updateFile(key, { status: "done", progress: 100, error: undefined })
        toast({
          type: "success",
          title: t("upload.toast.fileUploaded"),
          description: t("upload.toast.fileUploadedDesc", { name: item.file.name }),
          duration: 3500,
        })
        return
      }

      if (result.error?.code === 499) {
        updateFile(key, { status: "paused" })
        return
      }

      updateFile(key, {
        status: "error",
        error: result.error?.message ?? t("upload.toast.uploadErrorDesc", { name: item.file.name }),
      })

      toast({
        type: "error",
        title: t("upload.toast.uploadError"),
        description: t("upload.toast.uploadErrorDesc", { name: item.file.name }),
        duration: 5000,
      })
    },
    [apiClient, files, token, toast, updateFile, t]
  )

  const handleToggleFile = useCallback(
    (key: string, status: UploadQueueItem["status"]) => {
      if (status === "uploading") {
        pauseUpload(key)
        return
      }
      uploadOneFile(key)
    },
    [pauseUpload, uploadOneFile]
  )

  const handleStartAll = useCallback(() => {
    files.forEach((item) => {
      if (item.status !== "done" && item.status !== "uploading") {
        uploadOneFile(item.key)
      }
    })
  }, [files, uploadOneFile])

  const handlePauseAll = useCallback(() => {
    files.forEach((item) => {
      if (item.status === "uploading") {
        pauseUpload(item.key)
      }
    })
  }, [files, pauseUpload])

  const totalSize = useMemo(() => files.reduce((sum, item) => sum + item.file.size, 0), [files])

  return (
    <div className="grid grid-cols-1 gap-6 p-4 lg:grid-cols-2 lg:pt-0">
      {/* Left column: drop zone and summary */}
      <div className="flex flex-col gap-6">
        <DropZone onFilesChange={addFiles} files={files.map((item) => item.file)} />

        <div className="rounded-3xl border border-ui-border bg-ui-base p-6 shadow-ui">
          <h2 className="font-heading text-2xl tracking-wide text-ui-text">
            {t("upload.summary.title")}
          </h2>
          <div className="mt-4 space-y-2 text-sm text-ui-text-muted">
            <p>{t("upload.summary.totalFiles", { count: files.length })}</p>
            <p>{t("upload.summary.totalSize", { size: formatBytes(totalSize) })}</p>
          </div>
        </div>
      </div>

      {/* Right column: file queue */}
      <FileQueue
        files={files}
        onRemoveFile={removeFile}
        onToggleFile={handleToggleFile}
        onStartAll={handleStartAll}
        onPauseAll={handlePauseAll}
      />
    </div>
  )
}

export default UploadPage
