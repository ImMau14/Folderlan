import { type FC } from "react"
import { GiFiles } from "react-icons/gi"
import { FaPlay, FaStop } from "react-icons/fa6"

import FloatingContainer from "../../components/FloatingContainer"
import FileContainer from "./FileContainer"
import type { UploadQueueStatus } from "./FileContainer"
import { useI18n } from "@i18n/context/I18nContext"

export interface UploadQueueItem {
  key: string
  file: File
  progress: number
  status: UploadQueueStatus
  error?: string
}

interface FileQueueProps {
  files: UploadQueueItem[]
  onRemoveFile: (key: string) => void
  onToggleFile: (key: string, status: UploadQueueStatus) => void
  onStartAll: () => void
  onPauseAll: () => void
}

export const FileQueue: FC<FileQueueProps> = ({
  files,
  onRemoveFile,
  onToggleFile,
  onStartAll,
  onPauseAll,
}) => {
  const completedCount = files.filter((file) => file.status === "done").length
  const { t } = useI18n()
  const hasFiles = files.length > 0

  return (
    <FloatingContainer className="animate-fall-on-2 h-full overflow-hidden border border-ui-border px-0 brightness-[99%] filter lg:overflow-hidden">
      <div className="flex h-full w-full flex-col gap-4">
        {/* Cabecera */}
        <div className="flex shrink-0 items-start justify-between gap-4 px-8 sm:items-center">
          <div className="min-w-0">
            <h2 className="font-heading text-xl font-bold tracking-tight text-ui-text">
              {t("upload.queue.title")}
            </h2>
            <p className="mt-0.5 truncate text-sm font-medium text-ui-text-muted">
              {t("upload.queue.filesInQueue", { count: files.length })}
            </p>
          </div>

          {hasFiles && (
            <div className="flex shrink-0 items-center gap-2">
              <span className="shrink-0 rounded-full border border-ui-border bg-ui-front px-3 py-1.5 text-xs font-semibold text-ui-text-muted">
                {t("upload.queue.completed", { count: completedCount })}/{files.length}
              </span>
              <button
                onClick={onStartAll}
                className="rounded-xl border-2 border-ui-border-muted bg-ui-front p-2 text-ui-primary shadow-ui transition-transform duration-150 hover:scale-110"
                aria-label={t("upload.queue.startAll")}
                title={t("upload.queue.startAllLabel")}
              >
                <FaPlay aria-hidden />
                <span className="sr-only">{t("upload.queue.startAllLabel")}</span>
              </button>
              <button
                onClick={onPauseAll}
                className="rounded-xl border-2 border-ui-border-muted bg-ui-front p-2 text-ui-primary shadow-ui transition-transform duration-150 hover:scale-110"
                aria-label={t("upload.queue.pauseAll")}
                title={t("upload.queue.pauseAllLabel")}
              >
                <FaStop aria-hidden />
                <span className="sr-only">{t("upload.queue.pauseAllLabel")}</span>
              </button>
            </div>
          )}
        </div>

        {/* Lista de archivos o estado vacío */}
        {hasFiles ? (
          <div className="stagger-group flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pl-8 pr-5 scrollbar scrollbar-rounded scrollbar-thin scrollbar-thumb-ui-border scrollbar-track-transparent">
            {files.map((file) => (
              <FileContainer
                key={file.key}
                file={file.file}
                percent={file.progress}
                status={file.status}
                error={file.error}
                onToggleStartPause={() => onToggleFile(file.key, file.status)}
                onRemove={() => onRemoveFile(file.key)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center">
            <GiFiles className="mb-3 text-7xl text-ui-primary" />
            <h3 className="font-heading text-lg font-bold tracking-tight text-ui-text">
              {t("upload.queue.emptyTitle")}
            </h3>
            <p className="mt-1 max-w-xs text-center font-body text-sm font-medium text-ui-text-muted">
              {t("upload.queue.emptyDescription")}
            </p>
          </div>
        )}
      </div>
    </FloatingContainer>
  )
}

export default FileQueue
