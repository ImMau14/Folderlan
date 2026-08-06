/**
 * ResetPasswordModal — modal for the owner to reset a visitor's password.
 *
 * Collects a new password plus a confirmation field, validates they match
 * (with an inline live indicator) before calling the visitor-reset API.
 * On success it shows a success toast and closes; the user's account is
 * updated server-side and can be used with the new password right away.
 */
import { useCallback, useState } from "react"
import { motion } from "framer-motion"
import { FaKey } from "react-icons/fa6"
import { Check } from "lucide-react"
import clsx from "clsx"

import { useI18n } from "@i18n/context/I18nContext"
import { useToast } from "@toast/context/ToastContext"
import { useModal } from "@modal/context/ModalContext"
import Input from "@shared/components/Input"
import type { User } from "@shared/utils/ApiClient/types"
import ApiClient from "@shared/utils/ApiClient"

interface ResetPasswordModalProps {
  user: User
  apiClient: ApiClient
}

export default function ResetPasswordModal({ user, apiClient }: ResetPasswordModalProps) {
  const { t } = useI18n()
  const { toast } = useToast()
  const { close } = useModal()

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [saving, setSaving] = useState(false)

  const match = confirm.length > 0 ? confirm === password : null

  const handleSave = useCallback(async () => {
    if (saving) return

    if (!password.trim() || !confirm.trim()) {
      toast({
        type: "error",
        title: t("users.resetPassword.toast.missingFields"),
        description: t("users.resetPassword.toast.missingFieldsDesc"),
        duration: 4000,
      })
      return
    }

    if (password !== confirm) {
      toast({
        type: "error",
        title: t("users.resetPassword.toast.mismatch"),
        description: t("users.resetPassword.toast.mismatchDesc"),
        duration: 4000,
      })
      return
    }

    setSaving(true)
    const result = await apiClient.visitorResetPassword(user.username, password.trim())
    if (result.success) {
      toast({
        type: "success",
        title: t("users.toast.resetSuccess"),
        description: t("users.toast.resetSuccessDesc", { name: user.username }),
        duration: 3000,
      })
      close()
    } else {
      toast({
        type: "error",
        title: t("users.toast.resetError"),
        description: result.error.message,
        duration: 4000,
      })
    }
    setSaving(false)
  }, [saving, password, confirm, user, apiClient, toast, t, close])

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex items-center gap-4 border-b border-ui-border pb-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-ui-border-muted bg-ui-front">
          <FaKey className="text-xl text-ui-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-heading text-lg font-bold text-ui-text">
            {t("users.resetPassword.title")}
          </h3>
          <p className="truncate font-body text-sm text-ui-text-muted" title={user.username}>
            {t("users.resetPassword.subtitle", { name: user.username })}
          </p>
        </div>
      </div>

      <div className="flex w-full flex-col gap-3">
        <div className="flex w-full flex-col gap-1.5">
          <label className="font-body text-xs font-semibold uppercase tracking-wider text-ui-text-muted">
            {t("users.resetPassword.passwordLabel")}
          </label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("users.resetPassword.passwordPlaceholder")}
          />
        </div>
        <div className="flex w-full flex-col gap-1.5">
          <label className="font-body text-xs font-semibold uppercase tracking-wider text-ui-text-muted">
            {t("users.resetPassword.confirmLabel")}
          </label>
          <Input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={t("users.resetPassword.confirmPlaceholder")}
          />
          {match !== null && (
            <p
              className={clsx(
                "flex items-center gap-1.5 font-body text-xs font-medium",
                match ? "text-ui-success" : "text-ui-danger"
              )}
            >
              {match ? <Check className="h-3.5 w-3.5" /> : null}
              {match ? t("users.resetPassword.match") : t("users.resetPassword.mismatch")}
            </p>
          )}
        </div>
      </div>

      <div className="flex w-full gap-3 pt-2">
        <motion.button
          onClick={close}
          disabled={saving}
          whileTap={!saving ? { scale: 0.95 } : undefined}
          transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
          className="flex flex-1 cursor-pointer items-center justify-center rounded-full border-2 border-ui-border bg-ui-front px-4 py-2 font-body text-sm font-semibold text-ui-text transition-all hover:border-ui-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("users.cancel")}
        </motion.button>
        <motion.button
          onClick={handleSave}
          disabled={saving}
          whileTap={!saving ? { scale: 0.95 } : undefined}
          transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
          className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-ui-primary px-4 py-2 font-body text-sm font-semibold text-ui-highlight transition-all hover:bg-ui-primary-hover disabled:cursor-not-allowed disabled:opacity-50 dark:text-ui-base"
        >
          {saving ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <FaKey className="h-3.5 w-3.5" />
          )}
          {t("users.resetPassword.button")}
        </motion.button>
      </div>
    </div>
  )
}
