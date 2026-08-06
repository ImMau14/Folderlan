/**
 * CreateUserModal — modal to register a new visitor account.
 *
 * Collects a username, password and the initial permission set (upload,
 * delete own files, optional upload limit), validating the input before
 * calling the API. On success it fires the onSuccess callback, shows a
 * toast and closes the modal.
 */
import { useState, useCallback } from "react"
import { motion } from "framer-motion"
import { FaUserPlus } from "react-icons/fa6"
import clsx from "clsx"

import { useI18n } from "@i18n/context/I18nContext"
import { useToast } from "@toast/context/ToastContext"
import Input from "@shared/components/Input"
import ApiClient from "@shared/utils/ApiClient"
import type { PermsForm } from "./PermsModal"
import { useModal } from "@modal/context/ModalContext"

interface CreateUserModalProps {
  apiClient: ApiClient
  onSuccess: () => void
}

interface SwitchRowProps {
  checked: boolean
  label: string
  onToggle: (value: boolean) => void
}

function SwitchRow({ checked, label, onToggle }: SwitchRowProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!checked)}
      className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-ui-border-muted bg-ui-front px-4 py-3 transition-colors hover:border-ui-primary"
    >
      <span className="font-body text-sm font-medium text-ui-text">{label}</span>
      <span
        className={clsx(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200",
          checked ? "bg-ui-primary" : "bg-ui-border"
        )}
      >
        <span
          className={clsx(
            "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-200",
            checked ? "translate-x-6" : "translate-x-1"
          )}
        />
      </span>
    </button>
  )
}

export default function CreateUserModal({ apiClient, onSuccess }: CreateUserModalProps) {
  const { t } = useI18n()
  const { toast } = useToast()
  const { close } = useModal()

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [form, setForm] = useState<PermsForm>({
    can_upload: false,
    can_delete_own_files: false,
    has_upload_limits: false,
    upload_limit: "",
  })
  const [saving, setSaving] = useState(false)

  const handleSave = useCallback(async () => {
    if (!username.trim() || !password.trim()) {
      toast({
        type: "error",
        title: t("users.createUser.toast.missingFields"),
        description: t("users.createUser.toast.missingFieldsDesc"),
        duration: 4000,
      })
      return
    }

    let uploadLimit = 0
    if (form.has_upload_limits) {
      uploadLimit = Number(form.upload_limit)
      if (!Number.isFinite(uploadLimit) || uploadLimit < 0) {
        toast({
          type: "error",
          title: t("users.toast.invalidLimit"),
          description: t("users.toast.invalidLimitDesc"),
          duration: 4000,
        })
        return
      }
    }

    setSaving(true)
    const result = await apiClient.registerVisitor({
      username: username.trim(),
      password: password.trim(),
      can_upload: form.can_upload,
      can_delete_own_files: form.can_delete_own_files,
      has_upload_limits: form.has_upload_limits,
      upload_limit: uploadLimit,
    })
    if (result.success) {
      toast({
        type: "success",
        title: t("users.createUser.toast.success"),
        description: t("users.createUser.toast.successDesc", { name: username.trim() }),
        duration: 3000,
      })
      onSuccess()
      close()
    } else {
      toast({
        type: "error",
        title: t("users.createUser.toast.error"),
        description: result.error.message,
        duration: 4000,
      })
    }
    setSaving(false)
  }, [username, password, form, apiClient, toast, t, onSuccess, close])

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex items-center gap-4 border-b border-ui-border pb-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-ui-border-muted bg-ui-front">
          <FaUserPlus className="text-xl text-ui-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-heading text-lg font-bold text-ui-text">
            {t("users.createUser.title")}
          </h3>
          <p className="font-body text-sm text-ui-text-muted">{t("users.createUser.subtitle")}</p>
        </div>
      </div>

      <div className="flex w-full flex-col gap-3">
        <div className="flex w-full flex-col gap-1.5">
          <label className="font-body text-xs font-semibold uppercase tracking-wider text-ui-text-muted">
            {t("users.createUser.usernameLabel")}
          </label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t("users.createUser.usernamePlaceholder")}
          />
        </div>
        <div className="flex w-full flex-col gap-1.5">
          <label className="font-body text-xs font-semibold uppercase tracking-wider text-ui-text-muted">
            {t("users.createUser.passwordLabel")}
          </label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("users.createUser.passwordPlaceholder")}
          />
        </div>

        <div className="mt-1 flex w-full flex-col gap-3">
          <span className="font-body text-xs font-semibold uppercase tracking-wider text-ui-text-muted">
            {t("users.createUser.permissionsTitle")}
          </span>
          <SwitchRow
            checked={form.can_upload}
            label={t("users.canUpload")}
            onToggle={(value) => setForm((prev) => ({ ...prev, can_upload: value }))}
          />
          <SwitchRow
            checked={form.can_delete_own_files}
            label={t("users.canDelete")}
            onToggle={(value) => setForm((prev) => ({ ...prev, can_delete_own_files: value }))}
          />
          <SwitchRow
            checked={form.has_upload_limits}
            label={t("users.hasLimits")}
            onToggle={(value) => setForm((prev) => ({ ...prev, has_upload_limits: value }))}
          />
          <div className="flex w-full flex-col gap-1.5">
            <label className="font-body text-xs font-semibold uppercase tracking-wider text-ui-text-muted">
              {t("users.uploadLimitLabel")}
            </label>
            <Input
              type="number"
              min={0}
              disabled={!form.has_upload_limits}
              value={form.upload_limit}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  upload_limit: e.target.value.replace(/\D/g, ""),
                }))
              }
              placeholder={t("users.uploadLimitPlaceholder")}
            />
          </div>
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
          ) : null}
          {t("users.createUser.save")}
        </motion.button>
      </div>
    </div>
  )
}
