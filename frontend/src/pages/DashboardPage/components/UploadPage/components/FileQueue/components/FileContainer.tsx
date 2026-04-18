import { type FC } from "react"
import { motion, easeOut } from "framer-motion"
import { FaFile, FaPlay, FaStop } from "react-icons/fa6"
import { IoClose } from "react-icons/io5"

import formatBytes from "@utils/formatBytes"

interface FileContainerProps {
  file: File
  percent?: number
  status: "idle" | "uploading" | "paused" | "done"
  onToggleStartPause: () => void
  onRemove: () => void
}

export const FileContainer: FC<FileContainerProps> = ({
  file,
  percent = 0,
  status,
  onToggleStartPause,
  onRemove,
}) => {
  const isUploading = status === "uploading"
  const isDone = status === "done"

  return (
    <article className="flex w-full flex-row items-center gap-4 rounded-2xl border-2 border-ui-border-muted/50 bg-ui-front p-3 shadow-sm duration-100 hover:scale-105">
      <div className="rounded-xl border-2 border-ui-border-muted/40 bg-ui-base p-2">
        <FaFile className="text-3xl text-ui-text/80" aria-hidden />
      </div>

      <div className="flex h-full w-full flex-col justify-between gap-1">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-body font-semibold tracking-wide text-ui-text">{file.name}</h1>
            <p className="font-body text-xs text-ui-text-muted">{formatBytes(file.size)}</p>
          </div>
          <div className="text-xs text-ui-text-muted">{status}</div>
        </div>

        <div className="flex w-full flex-row items-center justify-center gap-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-ui-back">
            <motion.div
              className="h-full bg-green-700"
              initial={{ width: "0%" }}
              animate={{ width: `${percent}%` }}
              transition={{ duration: 0.2, ease: easeOut }}
              aria-valuenow={Math.round(percent)}
              role="progressbar"
            />
          </div>

          <div className="flex gap-2 text-ui-text/80">
            <button
              onClick={onToggleStartPause}
              aria-pressed={isUploading}
              aria-label={
                isUploading
                  ? "Pausar subida"
                  : isDone
                    ? "Reiniciar no disponible"
                    : "Iniciar / Reanudar subida"
              }
              title={isUploading ? "Pausar" : "Iniciar / Reanudar"}
              disabled={isDone}
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
      </div>
    </article>
  )
}

export default FileContainer
