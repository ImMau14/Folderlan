/**
 * DeleteModal — confirmation dialog for deleting a user.
 *
 * Asks for confirmation before soft-deleting the given user. On success it
 * shows a success toast, otherwise the API error; either way it refreshes
 * the list via onRefresh and closes.
 */
import { useCallback, useState } from "react"
import { motion } from "framer-motion"
import { FaTriangleExclamation, FaTrash } from "react-icons/fa6"

import { useI18n } from "@i18n/context/I18nContext"
import { useToast } from "@toast/context/ToastContext"
import { useModal } from "@modal/context/ModalContext"
import ApiClient from "@shared/utils/ApiClient"
import type { User } from "@shared/utils/ApiClient/types"

interface DeleteModalProps {
  user: User
  apiClient: ApiClient
  onRefresh: () => void
}

export default function DeleteModal({ user, apiClient, onRefresh }: DeleteModalProps) {
  const { t } = useI18n()
  const { toast } = useToast()
  const { close } = useModal()

  const [deleting, setDeleting] = useState(false)

  const handleConfirm = useCallback(async () => {
    if (deleting) return
    setDeleting(true)

    const result = await apiClient.deleteUser(user.id)
    if (result.success) {
      toast({
        type: "success",
        title: t("users.toast.deleteSuccess"),
        description: t("users.toast.deleteSuccessDesc", { name: user.username }),
        duration: 3000,
      })
    } else {
      toast({
        type: "error",
        title: t("users.toast.deleteError"),
        description: result.error.message,
        duration: 4000,
      })
    }

    onRefresh()
    close()
    setDeleting(false)
  }, [deleting, user, apiClient, toast, t, onRefresh, close])

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex items-center gap-4 border-b border-ui-border pb-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-ui-border bg-ui-danger/10">
          <FaTriangleExclamation className="text-xl text-ui-danger" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-heading text-lg font-bold text-ui-text">
            {t("users.deleteModal.title")}
          </h3>
          <p className="break-words font-body text-sm font-medium text-ui-text-muted">
            {t("users.deleteModal.confirm", { name: user.username })}
          </p>
        </div>
      </div>

      <div className="flex w-full gap-3 pt-2">
        <motion.button
          onClick={close}
          disabled={deleting}
          whileTap={!deleting ? { scale: 0.95 } : undefined}
          transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
          className="flex flex-1 cursor-pointer items-center justify-center rounded-full border-2 border-ui-border bg-ui-front px-4 py-2 font-body text-sm font-semibold text-ui-text transition-all hover:border-ui-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("users.cancel")}
        </motion.button>
        <motion.button
          onClick={handleConfirm}
          disabled={deleting}
          whileTap={!deleting ? { scale: 0.95 } : undefined}
          transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
          className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-ui-danger px-4 py-2 font-body text-sm font-semibold text-white transition-all hover:bg-ui-danger-hover disabled:cursor-not-allowed disabled:opacity-50 dark:text-ui-base"
        >
          {deleting ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <FaTrash className="h-4 w-4" />
          )}
          {t("users.deleteModal.confirmButton")}
        </motion.button>
      </div>
    </div>
  )
}
