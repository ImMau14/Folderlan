// DropZone component allows users to drag-and-drop or select files for upload.

import { useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FC } from "react"
import { FaCloudUploadAlt } from "react-icons/fa"
import clsx from "clsx"

import FloatingContainer from "../../FloatingContainer"
import formatBytes from "@utils/formatBytes"

interface DropZoneProps {
  onFilesChange?: (files: File[]) => void
  accept?: string
  files: File[]
}

const DropZone: FC<DropZoneProps> = ({ onFilesChange, accept, files = [] }) => {
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const fileCount = files.length
  const totalSize = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files])

  const addFiles = (incoming: FileList | File[]) => {
    const arr = Array.from(incoming)
    onFilesChange?.(arr)
  }

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy"
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy"
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer?.files && e.dataTransfer.files.length) {
      addFiles(e.dataTransfer.files)
    }
  }

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length) {
      addFiles(e.target.files)
    }
    e.currentTarget.value = ""
  }

  const openFileDialog = () => inputRef.current?.click()

  return (
    <FloatingContainer className="animate-fall-on-1">
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={useMemo(
          () =>
            clsx(
              "flex h-full w-full flex-col items-center justify-center rounded-2xl border-4 border-dashed p-6 text-center",
              dragActive ? "border-ui-primary bg-ui-primary/5" : "border-ui-border bg-green-700/5"
            ),
          [dragActive]
        )}
        aria-label="Soltar archivos aquí o usar el botón para seleccionarlos"
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          className="hidden"
          onChange={handleInputChange}
        />

        <FaCloudUploadAlt className="mb-4 text-8xl text-green-800/80" />
        <h1 className="font-heading text-3xl tracking-wide text-ui-text">Upload Files</h1>
        <span className="font-body text-ui-text-muted">Arrastra tus archivos aquí o selecciónalos manualmente</span>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            openFileDialog()
          }}
          className="my-4 flex items-center justify-center rounded-full bg-ui-primary px-6 py-2 font-body text-sm font-semibold tracking-wide text-white"
        >
          Select files
        </button>

        {fileCount > 0 && (
          <div className="mt-4 w-full rounded-2xl bg-ui-front px-4 py-3 text-left text-sm text-ui-text-muted shadow-sm">
            <p className="font-semibold text-ui-text">{fileCount} archivo{fileCount === 1 ? "" : "s"} listo{fileCount === 1 ? "" : "s"}</p>
            <p>{formatBytes(totalSize)} en total</p>
          </div>
        )}
      </div>
    </FloatingContainer>
  )
}

export default DropZone