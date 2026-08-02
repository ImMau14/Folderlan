import { AnimatePresence, motion } from "framer-motion"
import { FaTriangleExclamation } from "react-icons/fa6"
import { IoClose } from "react-icons/io5"

import { useI18n } from "@i18n/context/I18nContext"
import FloatingContainer from "../../components/FloatingContainer"

interface DeleteModalProps {
  open: boolean
  fileName: string
  deleting: boolean
  onConfirm: () => void
  onClose: () => void
}

export default function DeleteModal({
  open,
  fileName,
  deleting,
  onConfirm,
  onClose,
}: DeleteModalProps) {
  const { t } = useI18n()

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="delete-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className="w-full max-w-xl"
          >
            <FloatingContainer className="w-full !items-stretch overflow-hidden !p-5 text-left sm:!p-8">
              <div className="flex w-full items-center gap-4 border-b border-ui-border pb-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-ui-border-muted bg-ui-front">
                  <FaTriangleExclamation className="text-xl text-ui-danger" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-heading text-lg font-bold text-ui-text">
                    {t("download.delete.title")}
                  </h3>
                  <p className="mt-1 break-words font-body text-sm text-ui-text-muted">
                    {t("download.delete.confirm", { name: fileName })}
                  </p>
                </div>
                <motion.button
                  onClick={onClose}
                  disabled={deleting}
                  whileTap={{ scale: 0.9 }}
                  className="shrink-0 rounded-lg p-1.5 text-ui-text-muted transition-colors hover:bg-ui-front"
                >
                  <IoClose className="text-xl" />
                </motion.button>
              </div>

              <div className="flex w-full gap-3">
                <motion.button
                  onClick={onClose}
                  disabled={deleting}
                  whileTap={!deleting ? { scale: 0.95 } : undefined}
                  className="flex flex-1 items-center justify-center rounded-full border-2 border-ui-border bg-ui-front px-4 py-2 font-body text-sm font-semibold text-ui-text transition-all hover:border-ui-primary"
                >
                  {t("download.delete.cancel")}
                </motion.button>
                <motion.button
                  onClick={onConfirm}
                  disabled={deleting}
                  whileTap={!deleting ? { scale: 0.95 } : undefined}
                  className="flex flex-1 items-center justify-center gap-2 rounded-full bg-ui-danger px-4 py-2 font-body text-sm font-semibold text-ui-highlight transition-all hover:bg-ui-danger-hover disabled:opacity-50 dark:text-ui-base"
                >
                  {deleting ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      {t("download.delete.confirmButton")}
                    </>
                  ) : (
                    <>
                      <IoClose className="text-base" />
                      {t("download.delete.confirmButton")}
                    </>
                  )}
                </motion.button>
              </div>
            </FloatingContainer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
