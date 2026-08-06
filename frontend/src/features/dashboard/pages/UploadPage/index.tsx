import { useCallback, useEffect, useMemo, useRef, useState, type FC } from "react"
import type { CancelTokenSource } from "axios"

import { useAuth } from "@auth/context/AuthContext"
import { useToast } from "@toast/context/ToastContext"
import { useI18n } from "@i18n/context/I18nContext"

import ApiClient from "@shared/utils/ApiClient"
import { setPageName } from "@shared/utils/setPageName"
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
  const { token, user } = useAuth()
  const { toast } = useToast()
  const { t } = useI18n()

  useEffect(() => {
    setPageName(t("menu.upload"))
  }, [t])

  const cancelTokenMap = useRef<Record<string, CancelTokenSource | null>>({})
  const [files, setFiles] = useState<UploadQueueItem[]>([])
  const uploadResultsRef = useRef<{
    success: number
    failed: number
    total: number
    startedCount: number
  }>({
    success: 0,
    failed: 0,
    total: 0,
    startedCount: 0,
  })

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

  const showSummary = useCallback(() => {
    const { success, failed, total } = uploadResultsRef.current
    if (total === 0) return

    if (failed === 0) {
      toast({
        type: "success",
        title: t("upload.toast.uploadSummary"),
        description: t("upload.toast.uploadSummaryAll", { count: success }),
        duration: 5000,
      })
    } else {
      toast({
        type: failed === total ? "error" : "warning",
        title: t("upload.toast.uploadSummary"),
        description: t("upload.toast.uploadSummaryPartial", {
          success: String(success),
          total: String(total),
          failed: String(failed),
        }),
        duration: 6000,
      })
    }
  }, [toast, t])

  const checkAllDone = useCallback(() => {
    const current = uploadResultsRef.current
    if (current.total === 0) return
    if (current.startedCount > 0 && current.total < current.startedCount) return
    showSummary()
    uploadResultsRef.current = { success: 0, failed: 0, total: 0, startedCount: 0 }
  }, [showSummary])

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

      if (uploadResultsRef.current.startedCount === 0) {
        uploadResultsRef.current.startedCount = 1
      }

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
        uploadResultsRef.current.success++
        uploadResultsRef.current.total++
        checkAllDone()
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
      uploadResultsRef.current.failed++
      uploadResultsRef.current.total++
      checkAllDone()
    },
    [apiClient, files, token, toast, updateFile, t, checkAllDone]
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
    const pendingFiles = files.filter(
      (item) => item.status !== "done" && item.status !== "uploading"
    )
    uploadResultsRef.current = {
      success: 0,
      failed: 0,
      total: 0,
      startedCount: pendingFiles.length,
    }
    pendingFiles.forEach((item) => {
      uploadOneFile(item.key)
    })
  }, [files, uploadOneFile])

  const handlePauseAll = useCallback(() => {
    files.forEach((item) => {
      if (item.status === "uploading") {
        pauseUpload(item.key)
      }
    })
  }, [files, pauseUpload])

  return (
    <div className="grid grid-cols-1 gap-6 p-6 lg:h-full lg:min-h-0 lg:grid-cols-2 lg:grid-rows-[1fr]">
      {user && !user.can_upload ? (
        <div className="col-span-full flex flex-col items-center justify-center gap-4 py-16">
          <p className="font-body text-sm text-ui-text-muted">{t("upload.noPermission")}</p>
        </div>
      ) : (
        <>
          <DropZone onFilesChange={addFiles} files={files.map((item) => item.file)} />

          <FileQueue
            files={files}
            onRemoveFile={removeFile}
            onToggleFile={handleToggleFile}
            onStartAll={handleStartAll}
            onPauseAll={handlePauseAll}
          />
        </>
      )}
    </div>
  )
}

export default UploadPage
