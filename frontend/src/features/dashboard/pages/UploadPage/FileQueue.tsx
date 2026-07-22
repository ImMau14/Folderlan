/**
 * File upload queue with global controls and item list.
 */

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

  return (
    <FloatingContainer className="animate-fall-on-2 brightness-[99%] filter">
      <div className="relative flex h-full w-full flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="font-heading text-3xl tracking-wide text-ui-text">
                {t("upload.queue.title")}
              </h1>
              <p className="text-sm text-ui-text-muted">
                {t("upload.queue.filesInQueue", { count: files.length })}
              </p>
            </div>
            <div className="rounded-2xl border border-ui-border bg-ui-front px-3 py-2 text-sm text-ui-text-muted">
              {t("upload.queue.completed", { count: completedCount })}/{files.length}
            </div>
          </div>
        </div>

        <div className="flex h-full w-full flex-col items-center justify-center">
          {files.length === 0 ? (
            <>
              <GiFiles className="mb-4 text-9xl text-green-800/80" />
              <h2 className="font-heading text-3xl tracking-wide text-ui-text">
                {t("upload.queue.emptyTitle")}
              </h2>
              <p className="px-8 pb-20 text-center font-body text-ui-text">
                {t("upload.queue.emptyDescription")}
              </p>
            </>
          ) : (
            <div className="stagger-group flex h-full w-full flex-col gap-2">
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
          )}
        </div>

        {files.length !== 0 && (
          <div className="absolute right-0 top-0 flex justify-center gap-2">
            <button
              onClick={onStartAll}
              className="border-ui-border-muted/50 rounded-xl border-2 bg-ui-front p-2 shadow-ui transition-transform duration-150 hover:scale-110"
              aria-label={t("upload.queue.startAll")}
              title={t("upload.queue.startAllLabel")}
            >
              <FaPlay className="text-ui-text/80" aria-hidden />
              <span className="sr-only">{t("upload.queue.startAllLabel")}</span>
            </button>

            <button
              onClick={onPauseAll}
              className="border-ui-border-muted/50 rounded-xl border-2 bg-ui-front p-2 shadow-ui transition-transform duration-150 hover:scale-110"
              aria-label={t("upload.queue.pauseAll")}
              title={t("upload.queue.pauseAllLabel")}
            >
              <FaStop className="text-ui-text/80" aria-hidden />
              <span className="sr-only">{t("upload.queue.pauseAllLabel")}</span>
            </button>
          </div>
        )}
      </div>
    </FloatingContainer>
  )
}

export default FileQueue
