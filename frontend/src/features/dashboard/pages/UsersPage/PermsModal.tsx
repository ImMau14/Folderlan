import { useState, useCallback } from "react"
import { motion } from "framer-motion"
import { FaGear } from "react-icons/fa6"
import clsx from "clsx"

import { useI18n } from "@i18n/context/I18nContext"
import { useToast } from "@toast/context/ToastContext"
import { useModal } from "@modal/context/ModalContext"
import Input from "@shared/components/Input"
import type { User } from "@shared/utils/ApiClient/types"
import ApiClient from "@shared/utils/ApiClient"

export interface PermsForm {
  can_upload: boolean
  can_delete_own_files: boolean
  has_upload_limits: boolean
  upload_limit: string
}

interface PermsModalProps {
  user: User
  apiClient: ApiClient
  onRefresh: () => void
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
      className="flex w-full items-center justify-between rounded-xl border border-ui-border-muted bg-ui-front px-4 py-3 transition-colors hover:border-ui-primary"
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

function formFromUser(user: User): PermsForm {
  return {
    can_upload: user.can_upload,
    can_delete_own_files: user.can_delete_own_files,
    has_upload_limits: user.has_upload_limits,
    upload_limit: user.upload_limit > 0 ? String(user.upload_limit) : "",
  }
}

export default function PermsModal({ user, apiClient, onRefresh }: PermsModalProps) {
  const { t } = useI18n()
  const { toast } = useToast()
  const { close } = useModal()

  const [form, setForm] = useState<PermsForm>(() => formFromUser(user))
  const [saving, setSaving] = useState(false)

  const handleSave = useCallback(async () => {
    if (saving) return

    let uploadLimit: number | undefined
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
    const result = await apiClient.updateUserPerms(user.id, {
      can_upload: form.can_upload,
      can_delete_own_files: form.can_delete_own_files,
      has_upload_limits: form.has_upload_limits,
      ...(uploadLimit !== undefined ? { upload_limit: uploadLimit } : {}),
    })
    if (result.success) {
      toast({
        type: "success",
        title: t("users.toast.permsSuccess"),
        description: t("users.toast.permsSuccessDesc", { name: user.username }),
        duration: 3000,
      })
      onRefresh()
    } else {
      toast({
        type: "error",
        title: t("users.toast.permsError"),
        description: result.error.message,
        duration: 4000,
      })
    }
    setSaving(false)
  }, [form, saving, apiClient, user, toast, t, onRefresh])

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex items-center gap-4 border-b border-ui-border pb-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-ui-border-muted bg-ui-front">
          <FaGear className="text-xl text-ui-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-heading text-lg font-bold text-ui-text">
            {t("users.permsModal.title")}
          </h3>
          <p className="truncate font-body text-sm text-ui-text-muted" title={user.username}>
            {t("users.permsModal.subtitle", { name: user.username })}
          </p>
        </div>
      </div>

      <div className="flex w-full flex-col gap-3">
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

      <div className="flex w-full gap-3 pt-2">
        <motion.button
          onClick={close}
          disabled={saving}
          whileTap={!saving ? { scale: 0.95 } : undefined}
          className="flex flex-1 items-center justify-center rounded-full border-2 border-ui-border bg-ui-front px-4 py-2 font-body text-sm font-semibold text-ui-text transition-all hover:border-ui-primary disabled:opacity-50"
        >
          {t("users.cancel")}
        </motion.button>
        <motion.button
          onClick={handleSave}
          disabled={saving}
          whileTap={!saving ? { scale: 0.95 } : undefined}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-ui-primary px-4 py-2 font-body text-sm font-semibold text-ui-highlight transition-all hover:bg-ui-primary-hover disabled:opacity-50 dark:text-ui-base"
        >
          {saving ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : null}
          {t("users.save")}
        </motion.button>
      </div>
    </div>
  )
}
