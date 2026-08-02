import { AnimatePresence, motion } from "framer-motion"
import { FaDownload, FaTrash, FaLock, FaGlobe, FaFile, FaMagnifyingGlass } from "react-icons/fa6"
import clsx from "clsx"

import { useI18n } from "@i18n/context/I18nContext"
import formatBytes from "@shared/utils/formatBytes"
import type { FileItem } from "@shared/utils/ApiClient/types"
import FloatingContainer from "../../components/FloatingContainer"

interface FileTableProps {
  files: FileItem[]
  loading: boolean
  onDownload: (file: FileItem) => void
  onOpenPermModal: (file: FileItem) => void
  onOpenDeleteModal: (file: FileItem) => void
}

export default function FileTable({
  files,
  loading,
  onDownload,
  onOpenPermModal,
  onOpenDeleteModal,
}: FileTableProps) {
  const { t } = useI18n()

  return (
    <FloatingContainer
      className={clsx(
        "w-full border border-ui-border",
        loading && files.length === 0 ? "min-h-[300px]" : ""
      )}
    >
      {loading && files.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-ui-border border-t-ui-primary" />
          <p className="font-body text-sm font-medium text-ui-text-muted">
            {t("download.table.loading")}
          </p>
        </div>
      ) : files.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <FaMagnifyingGlass className="text-ui-text-muted/40 text-3xl" />
          <p className="font-heading text-lg font-bold text-ui-text">
            {t("download.table.noFiles")}
          </p>
          <p className="font-body text-sm text-ui-text-muted">{t("download.table.noFilesDesc")}</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden w-full overflow-x-auto scrollbar scrollbar-thin scrollbar-thumb-ui-border scrollbar-track-transparent md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-ui-border font-body text-xs font-semibold uppercase tracking-wider text-ui-text-muted">
                  <th className="px-4 py-3.5 text-left">{t("download.table.fileName")}</th>
                  <th className="px-4 py-3.5 text-right">{t("download.table.size")}</th>
                  <th className="px-4 py-3.5 text-left">{t("download.table.uploader")}</th>
                  <th className="px-4 py-3.5 text-left">{t("download.table.date")}</th>
                  <th className="px-4 py-3.5 text-center">{t("download.table.type")}</th>
                  <th className="px-4 py-3.5 text-right">{t("download.table.actions")}</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout">
                  {files.map((file, idx) => (
                    <motion.tr
                      key={file.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.25, delay: idx * 0.03, ease: [0.2, 0, 0, 1] }}
                      layout
                      className={clsx(
                        "hover:bg-ui-front/70 group border-ui-border-muted transition-colors",
                        idx === files.length - 1 ? "" : "border-b"
                      )}
                    >
                      <td className="max-w-[200px] px-4 py-3.5 lg:max-w-[320px]">
                        <div className="flex items-center gap-3">
                          <FaFile className="shrink-0 text-sm text-ui-text-muted" />
                          <span
                            className="truncate font-body text-sm font-medium text-ui-text"
                            title={file.name}
                          >
                            {file.name}
                          </span>
                          {file.is_public && (
                            <FaGlobe
                              className="shrink-0 text-xs text-ui-success"
                              title={t("download.table.public")}
                            />
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right font-body text-sm tabular-nums text-ui-text">
                        {formatBytes(file.size_bytes)}
                      </td>
                      <td className="max-w-[120px] truncate px-4 py-3.5 font-body text-sm text-ui-text-muted">
                        {file.uploaded_by ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 font-body text-sm text-ui-text-muted">
                        {file.uploaded_at ? new Date(file.uploaded_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-block max-w-[80px] truncate rounded-lg bg-ui-front px-2.5 py-1 font-body text-xs text-ui-text-muted">
                          {file.mime_type ?? "—"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <motion.button
                            onClick={() => onDownload(file)}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            className="rounded-lg p-2 text-ui-primary opacity-100 transition-all hover:bg-ui-front"
                            title={t("download.actions.download")}
                          >
                            <FaDownload className="text-sm" />
                          </motion.button>
                          <motion.button
                            onClick={() => onOpenPermModal(file)}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            className="rounded-lg p-2 text-ui-info opacity-100 transition-all hover:bg-ui-front"
                            title={t("download.actions.permissions")}
                          >
                            <FaLock className="text-sm" />
                          </motion.button>
                          <motion.button
                            onClick={() => onOpenDeleteModal(file)}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            className="rounded-lg p-2 text-ui-danger opacity-100 transition-all hover:bg-ui-front"
                            title={t("download.actions.delete")}
                          >
                            <FaTrash className="text-sm" />
                          </motion.button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="flex w-full flex-col gap-2 md:hidden">
            <AnimatePresence mode="popLayout">
              {files.map((file, idx) => (
                <motion.div
                  key={file.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25, delay: idx * 0.03, ease: [0.2, 0, 0, 1] }}
                  layout
                  className="bg-ui-front/50 flex items-center gap-3 rounded-xl border border-ui-border-muted p-3 transition-colors hover:bg-ui-front"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <FaFile className="shrink-0 text-sm text-ui-text-muted" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="truncate font-body text-sm font-medium text-ui-text"
                          title={file.name}
                        >
                          {file.name}
                        </span>
                        {file.is_public && (
                          <FaGlobe
                            className="shrink-0 text-xs text-ui-success"
                            title={t("download.table.public")}
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-ui-text-muted">
                        <span>{formatBytes(file.size_bytes)}</span>
                        <span>·</span>
                        <span className="truncate">{file.uploaded_by ?? "—"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <motion.button
                      onClick={() => onDownload(file)}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="rounded-lg p-2 text-ui-primary transition-all hover:bg-ui-front"
                      title={t("download.actions.download")}
                    >
                      <FaDownload className="text-sm" />
                    </motion.button>
                    <motion.button
                      onClick={() => onOpenPermModal(file)}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="rounded-lg p-2 text-ui-info transition-all hover:bg-ui-front"
                      title={t("download.actions.permissions")}
                    >
                      <FaLock className="text-sm" />
                    </motion.button>
                    <motion.button
                      onClick={() => onOpenDeleteModal(file)}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="rounded-lg p-2 text-ui-danger transition-all hover:bg-ui-front"
                      title={t("download.actions.delete")}
                    >
                      <FaTrash className="text-sm" />
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      )}
    </FloatingContainer>
  )
}
