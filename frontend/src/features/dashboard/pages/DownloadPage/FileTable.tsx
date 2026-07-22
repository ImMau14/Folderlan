import { AnimatePresence, motion } from "framer-motion"
import { FaSearch, FaDownload, FaTrash, FaLock, FaGlobe } from "react-icons/fa"
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
        <div className="flex flex-col items-center gap-3 py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-ui-border border-t-ui-primary" />
          <p className="font-body text-sm font-medium text-ui-text-muted">
            {t("download.table.loading")}
          </p>
        </div>
      ) : files.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <FaSearch className="text-4xl text-ui-text-muted" />
          <p className="font-heading text-lg font-bold text-ui-text">
            {t("download.table.noFiles")}
          </p>
          <p className="font-body text-sm text-ui-text-muted">{t("download.table.noFilesDesc")}</p>
        </div>
      ) : (
        <div className="w-full overflow-x-auto scrollbar scrollbar-thin scrollbar-thumb-ui-border scrollbar-track-transparent">
          <table className="w-full">
            <thead>
              <tr className="border-b border-ui-border font-body text-xs font-semibold uppercase tracking-wider text-ui-text-muted">
                <th className="px-4 py-3 text-left">{t("download.table.fileName")}</th>
                <th className="px-4 py-3 text-right">{t("download.table.size")}</th>
                <th className="hidden px-4 py-3 text-left sm:table-cell">
                  {t("download.table.uploader")}
                </th>
                <th className="hidden px-4 py-3 text-left md:table-cell">
                  {t("download.table.date")}
                </th>
                <th className="px-4 py-3 text-center">{t("download.table.type")}</th>
                <th className="px-4 py-3 text-right">{t("download.table.actions")}</th>
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
                      "hover:bg-ui-front/50 border-ui-border-muted transition-colors",
                      idx === files.length - 1 ? "border-b-0" : "border-b"
                    )}
                  >
                    <td className="max-w-[200px] px-4 py-3">
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
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-body text-sm tabular-nums text-ui-text">
                      {formatBytes(file.size_bytes)}
                    </td>
                    <td className="hidden max-w-[120px] truncate px-4 py-3 font-body text-sm text-ui-text-muted sm:table-cell">
                      {file.uploaded_by ?? "—"}
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 font-body text-sm text-ui-text-muted md:table-cell">
                      {file.uploaded_at ? new Date(file.uploaded_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-block max-w-[80px] truncate rounded-full bg-ui-front px-2 py-0.5 font-body text-xs text-ui-text-muted">
                        {file.mime_type ?? "—"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <motion.button
                          onClick={() => onDownload(file)}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className="hover:bg-ui-primary/10 rounded-full p-2 text-ui-primary transition-colors hover:text-ui-primary-hover"
                          title={t("download.actions.download")}
                        >
                          <FaDownload />
                        </motion.button>
                        <motion.button
                          onClick={() => onOpenPermModal(file)}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className="hover:bg-ui-info/10 rounded-full p-2 text-ui-info transition-colors hover:text-ui-info-hover"
                          title={t("download.actions.permissions")}
                        >
                          <FaLock />
                        </motion.button>
                        <motion.button
                          onClick={() => onOpenDeleteModal(file)}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className="hover:bg-ui-danger/10 rounded-full p-2 text-ui-danger transition-colors hover:text-ui-danger-hover"
                          title={t("download.actions.delete")}
                        >
                          <FaTrash />
                        </motion.button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}
    </FloatingContainer>
  )
}
