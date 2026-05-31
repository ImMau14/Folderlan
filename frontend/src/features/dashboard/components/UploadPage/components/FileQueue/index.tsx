import { type FC } from "react"
import { GiFiles } from "react-icons/gi"
import { FaPlay, FaStop } from "react-icons/fa6"

import FloatingContainer from "../../../FloatingContainer"
import FileContainer from "./components/FileContainer"
import type { UploadQueueStatus } from "./components/FileContainer"

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

  return (
    <FloatingContainer className="animate-fall-on-2 brightness-[99%] filter">
      <div className="relative flex h-full w-full flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="font-heading text-3xl tracking-wide text-ui-text">File Queue</h1>
              <p className="text-sm text-ui-text-muted">
                {files.length} archivo{files.length === 1 ? "" : "s"} en cola
              </p>
            </div>
            <div className="rounded-2xl border border-ui-border bg-ui-front px-3 py-2 text-sm text-ui-text-muted">
              {completedCount}/{files.length} completados
            </div>
          </div>
        </div>

        <div className="flex h-full w-full flex-col items-center justify-center">
          {files.length === 0 ? (
            <>
              <GiFiles className="mb-4 text-9xl text-green-800/80" />
              <h2 className="font-heading text-3xl tracking-wide text-ui-text">Empty Queue</h2>
              <p className="px-8 pb-20 text-center font-body text-ui-text">
                Los archivos seleccionados aparecerán aquí para iniciar la subida.
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
              className="ease rounded-xl border-2 border-ui-border-muted/50 bg-ui-front p-2 shadow-ui-2 duration-150 hover:scale-110"
              aria-label="Iniciar todas las subidas"
              title="Iniciar todo"
            >
              <FaPlay className="text-ui-text/80" aria-hidden />
              <span className="sr-only">Iniciar todo</span>
            </button>

            <button
              onClick={onPauseAll}
              className="ease rounded-xl border-2 border-ui-border-muted/50 bg-ui-front p-2 shadow-ui-2 duration-150 hover:scale-110"
              aria-label="Pausar todas las subidas"
              title="Pausar todo"
            >
              <FaStop className="text-ui-text/80" aria-hidden />
              <span className="sr-only">Pausar todo</span>
            </button>
          </div>
        )}
      </div>
    </FloatingContainer>
  )
}

export default FileQueue
