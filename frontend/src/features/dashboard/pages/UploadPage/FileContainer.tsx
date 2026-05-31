/**
 * Tarjeta de un archivo en la cola de subida con barra de progreso y acciones.
 */

import { type FC } from "react"
import { motion, easeOut } from "framer-motion"
import { FaFile, FaPlay, FaStop } from "react-icons/fa6"
import { IoClose } from "react-icons/io5"

import formatBytes from "@shared/utils/formatBytes"

export type UploadQueueStatus = "idle" | "uploading" | "paused" | "done" | "error"

interface FileContainerProps {
  file: File
  percent?: number
  status: UploadQueueStatus
  error?: string
  onToggleStartPause: () => void
  onRemove: () => void
}

export const FileContainer: FC<FileContainerProps> = ({
  file,
  percent = 0,
  status,
  error,
  onToggleStartPause,
  onRemove,
}) => {
  const isUploading = status === "uploading"
  const isDone = status === "done"
  const isError = status === "error"

  return (
    <article className="border-ui-border-muted/50 flex w-full flex-col gap-2 rounded-2xl border-2 bg-ui-front p-3 shadow-sm transition-transform duration-100 hover:scale-105 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex items-center gap-4">
        <div className="border-ui-border-muted/40 rounded-xl border-2 bg-ui-base p-2">
          <FaFile className="text-ui-text/80 text-3xl" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-body font-semibold tracking-wide text-ui-text">
            {file.name}
          </h1>
          <p className="text-xs text-ui-text-muted">{formatBytes(file.size)}</p>
        </div>
        <div className="text-xs text-ui-text-muted">
          {isError ? "Error" : isDone ? "Completado" : status}
        </div>
      </div>

      <div className="flex w-full items-center gap-2 sm:w-auto sm:flex-1">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-ui-back">
          <motion.div
            className={isError ? "h-full bg-red-600" : "h-full bg-green-700"}
            initial={{ width: "0%" }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.2, ease: easeOut }}
            aria-valuenow={Math.round(percent)}
            role="progressbar"
          />
        </div>

        <div className="text-ui-text/80 flex gap-2">
          <button
            onClick={onToggleStartPause}
            aria-pressed={isUploading}
            disabled={isDone}
            aria-label={
              isUploading
                ? "Pausar subida"
                : isDone
                  ? "Reiniciar no disponible"
                  : isError
                    ? "Reintentar subida"
                    : "Iniciar / reanudar subida"
            }
            title={
              isUploading
                ? "Pausar"
                : isDone
                  ? "Completado"
                  : isError
                    ? "Reintentar"
                    : "Iniciar / Reanudar"
            }
          >
            {isUploading ? (
              <FaStop className="text-sm" aria-hidden />
            ) : (
              <FaPlay className="text-sm" aria-hidden />
            )}
            <span className="sr-only">{isUploading ? "Pausar" : "Iniciar"}</span>
          </button>

          <button onClick={onRemove} aria-label="Eliminar archivo" title="Eliminar">
            <IoClose className="text-sm text-red-800" aria-hidden />
            <span className="sr-only">Eliminar</span>
          </button>
        </div>
      </div>

      {isError && error ? <p className="text-xs text-red-600">{error}</p> : null}
    </article>
  )
}

export default FileContainer
