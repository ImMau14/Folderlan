import { AnimatePresence, motion } from "framer-motion"

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
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1], delay: 0.05 }}
          >
            <FloatingContainer className="max-w-md border border-ui-border">
              <h3 className="w-full text-left font-heading text-lg font-bold text-ui-text">
                {t("download.delete.title")}
              </h3>
              <p className="w-full max-w-full break-words text-left font-body text-sm text-ui-text-muted">
                {t("download.delete.confirm", { name: fileName })}
              </p>
              <div className="flex w-full gap-3">
                <motion.button
                  onClick={onClose}
                  disabled={deleting}
                  whileTap={!deleting ? { scale: 0.95 } : undefined}
                  className="flex-1 rounded-full border-2 border-ui-border bg-ui-front px-4 py-2 font-body text-sm font-semibold text-ui-text transition-all hover:border-ui-primary"
                >
                  {t("download.delete.cancel")}
                </motion.button>
                <motion.button
                  onClick={onConfirm}
                  disabled={deleting}
                  whileTap={!deleting ? { scale: 0.95 } : undefined}
                  className="flex-1 rounded-full bg-ui-danger px-4 py-2 font-body text-sm font-semibold text-ui-highlight transition-all hover:bg-ui-danger-hover disabled:opacity-50"
                >
                  {deleting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      {t("download.delete.confirmButton")}
                    </span>
                  ) : (
                    t("download.delete.confirmButton")
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
