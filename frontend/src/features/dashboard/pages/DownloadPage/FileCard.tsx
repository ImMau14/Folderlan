/**
 * FileCard — a single file entry in the downloads grid.
 *
 * Shows the file icon (derived from its MIME type), name, size, upload date
 * and visibility, plus quick actions: toggle public/private and download.
 * Clicking anywhere on the card toggles its selection.
 */
import { useCallback } from "react"
import { motion } from "framer-motion"
import {
  FaFile,
  FaFilePdf,
  FaFileWord,
  FaFileExcel,
  FaFileImage,
  FaGlobe,
  FaLock,
  FaCheck,
  FaDownload,
  FaUser,
} from "react-icons/fa6"
import clsx from "clsx"

import formatBytes from "@shared/utils/formatBytes"
import type { FileItem } from "@shared/utils/ApiClient/types"
import { useI18n } from "@i18n/context/I18nContext"
import { useAuth } from "@auth/context/AuthContext"

interface FileCardProps {
  file: FileItem
  isSelected: boolean
  onSelect: (file: FileItem) => void
  onDoubleClick: (file: FileItem) => void
  onToggleVisibility: (file: FileItem) => void
  index: number
}

/**
 * Maps a MIME type to a visual icon + colour pair.
 * Unknown or missing types fall back to a generic file icon.
 */
function getFileIcon(mimeType: string | null | undefined) {
  if (!mimeType) return { icon: FaFile, color: "text-ui-text-muted", bg: "bg-ui-base" }
  if (mimeType.startsWith("image/"))
    return { icon: FaFileImage, color: "text-purple-500", bg: "bg-purple-500/10" }
  if (mimeType.includes("pdf"))
    return { icon: FaFilePdf, color: "text-red-500", bg: "bg-red-500/10" }
  if (mimeType.includes("word") || mimeType.includes("document"))
    return { icon: FaFileWord, color: "text-blue-500", bg: "bg-blue-500/10" }
  if (mimeType.includes("sheet") || mimeType.includes("excel"))
    return { icon: FaFileExcel, color: "text-green-500", bg: "bg-green-500/10" }
  return { icon: FaFile, color: "text-ui-text-muted", bg: "bg-ui-base" }
}

export default function FileCard({
  file,
  isSelected,
  onSelect,
  onDoubleClick,
  onToggleVisibility,
  index,
}: FileCardProps) {
  const { icon: IconComponent, color, bg } = getFileIcon(file.mime_type)
  const { t } = useI18n()
  const { user } = useAuth()

  // Uploader display name; falls back to an id or a placeholder when the
  // uploader account is missing (e.g. soft-deleted user).
  const uploaderName =
    typeof file.uploaded_by === "string"
      ? file.uploaded_by
      : typeof file.uploaded_by === "number"
        ? `User #${file.uploaded_by}`
        : "—"

  // Management actions (toggle public/private) require collaborator level or owner.
  // Falls back to the role when the backend does not send `my_access` yet.
  const canManage =
    file.my_access === "owner" ||
    file.my_access === "collaborator" ||
    (!file.my_access && user?.role === "owner")

  // Delegates clicks to the parent so the grid owns all selection logic.
  const handleClick = useCallback(() => {
    onSelect(file)
  }, [file, onSelect])

  return (
    <motion.div
      data-file-card=""
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: -8 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.24), ease: [0.2, 0, 0, 1] }}
      layout
      onClick={handleClick}
      className={clsx(
        "card relative min-h-[160px] cursor-pointer justify-between overflow-hidden",
        isSelected && "!border-ui-primary ring-1 ring-ui-primary"
      )}
    >
      {/* Top section: icon + selection checkbox */}
      <div className="flex w-full items-start justify-between">
        <div
          className={clsx(
            "flex h-12 w-12 items-center justify-center rounded-xl border border-ui-border-muted shadow-sm",
            bg
          )}
        >
          <IconComponent className={clsx("h-6 w-6", color)} />
        </div>
        <div
          className={clsx(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-md shadow-sm transition-all",
            isSelected
              ? "border-ui-primary bg-ui-primary text-white"
              : "border-2 border-ui-border bg-ui-front group-hover:border-ui-text-muted"
          )}
        >
          {isSelected && <FaCheck className="h-3 w-3" />}
        </div>
      </div>

      {/* Center section: file metadata */}
      <div className="mt-4 flex w-full min-w-0 flex-col">
        <h3
          className="truncate font-heading text-base font-semibold text-ui-text"
          title={file.name}
        >
          {file.name}
        </h3>
        <p className="mt-1 flex items-center gap-2 font-body text-xs font-medium text-ui-text-muted">
          <span>{formatBytes(file.size_bytes)}</span>
          <span className="h-1 w-1 rounded-full bg-ui-border"></span>
          <span>{file.uploaded_at ? new Date(file.uploaded_at).toLocaleDateString() : "—"}</span>
        </p>
        <p
          className="mt-1 flex min-w-0 items-center gap-1.5 font-body text-xs font-medium text-ui-text-muted"
          title={t("download.uploadedBy", { name: uploaderName })}
        >
          <FaUser className="h-3 w-3 shrink-0" />
          <span className="truncate">{uploaderName}</span>
        </p>
      </div>

      {/* Bottom section: visibility badge + quick actions */}
      <div className="mt-4 flex w-full items-center justify-between border-t border-ui-border pt-3">
        <span
          className={clsx(
            "font-body text-xs font-semibold uppercase tracking-wider",
            file.is_public ? "text-green-600" : "text-ui-text-muted"
          )}
        >
          {file.is_public ? t("download.filters.public") : t("download.filters.private")}
        </span>

        <div className="flex shrink-0 items-center gap-1">
          {/* Toggle public/private for this file only (needs collaborator level) */}
          {canManage && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggleVisibility(file)
              }}
              title={
                file.is_public
                  ? t("download.actions.makePrivate")
                  : t("download.actions.makePublic")
              }
              className="rounded-lg p-2 text-ui-text-muted transition-colors hover:bg-ui-base hover:text-ui-text"
            >
              {file.is_public ? <FaGlobe className="h-4 w-4" /> : <FaLock className="h-4 w-4" />}
            </button>
          )}
          {/* Download this file */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDoubleClick(file)
            }}
            title={t("download.actions.download")}
            className="rounded-lg p-2 text-ui-text-muted transition-colors hover:bg-ui-base hover:text-ui-primary"
          >
            <FaDownload className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}
