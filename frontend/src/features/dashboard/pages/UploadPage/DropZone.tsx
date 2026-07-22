/**
 * Drop zone for file uploads with manual selection button.
 */

import { useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FC } from "react"
import { FaCloudUploadAlt } from "react-icons/fa"
import clsx from "clsx"

import FloatingContainer from "../../components/FloatingContainer"
import formatBytes from "@shared/utils/formatBytes"
import { useI18n } from "@i18n/context/I18nContext"

interface DropZoneProps {
  onFilesChange?: (files: File[]) => void
  accept?: string
  files: File[]
}

const DropZone: FC<DropZoneProps> = ({ onFilesChange, accept, files = [] }) => {
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const { t } = useI18n()

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
    <FloatingContainer className="animate-fall-on-1 h-full border border-ui-border">
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={useMemo(
          () =>
            clsx(
              "flex h-full w-full flex-col items-center justify-center rounded-2xl border-[3px] border-dashed p-8 text-center transition-all duration-200",
              dragActive ? "border-ui-primary-hover" : "border-ui-primary"
            ),
          [dragActive]
        )}
        aria-label={t("upload.dropZone.description")}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          className="hidden"
          onChange={handleInputChange}
        />

        <FaCloudUploadAlt className="mb-3 text-7xl text-ui-primary" />
        <h2 className="font-heading text-xl font-bold tracking-tight text-ui-text">
          {t("upload.dropZone.title")}
        </h2>
        <span className="mt-1 font-body text-sm font-medium text-ui-text-muted">
          {t("upload.dropZone.description")}
        </span>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            openFileDialog()
          }}
          className="mt-4 flex items-center justify-center rounded-full bg-ui-primary px-6 py-2.5 font-body text-sm font-semibold tracking-wide text-ui-highlight shadow-md transition-all duration-200 hover:scale-105 hover:bg-ui-primary-hover hover:shadow-lg active:scale-95 dark:text-ui-base"
        >
          {t("upload.dropZone.selectFiles")}
        </button>

        {fileCount > 0 && (
          <div className="mt-5 w-full rounded-2xl bg-ui-front px-4 py-3 text-left text-sm shadow-sm">
            <p className="font-semibold text-ui-text">
              {t("upload.dropZone.filesReady", { count: fileCount })}
            </p>
            <p className="mt-0.5 font-medium text-ui-text-muted">
              {t("upload.dropZone.totalSize", { size: formatBytes(totalSize) })}
            </p>
          </div>
        )}
      </div>
    </FloatingContainer>
  )
}

export default DropZone
