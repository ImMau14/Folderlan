import { AnimatePresence, motion } from "framer-motion"
import { FaGear } from "react-icons/fa6"
import { IoClose } from "react-icons/io5"
import clsx from "clsx"

import { useI18n } from "@i18n/context/I18nContext"
import Input from "@shared/components/Input"
import type { User } from "@shared/utils/ApiClient/types"
import FloatingContainer from "../../components/FloatingContainer"

export interface PermsForm {
  can_upload: boolean
  can_delete_own_files: boolean
  has_upload_limits: boolean
  upload_limit: string
}

interface PermsModalProps {
  open: boolean
  user: User | null
  form: PermsForm
  saving: boolean
  onFormChange: (form: PermsForm) => void
  onSave: () => void
  onClose: () => void
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

export default function PermsModal({
  open,
  user,
  form,
  saving,
  onFormChange,
  onSave,
  onClose,
}: PermsModalProps) {
  const { t } = useI18n()

  return (
    <AnimatePresence>
      {open && user && (
        <motion.div
          key="perms-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={saving ? undefined : onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className="w-full max-w-lg"
          >
            <FloatingContainer className="max-h-[85vh] w-full !items-stretch overflow-hidden !p-5 text-left sm:!p-8">
              <div className="flex w-full items-center gap-4 border-b border-ui-border pb-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-ui-border-muted bg-ui-front">
                  <FaGear className="text-xl text-ui-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-heading text-lg font-bold text-ui-text">
                    {t("users.permsModal.title")}
                  </h3>
                  <p
                    className="truncate font-body text-sm text-ui-text-muted"
                    title={user.username}
                  >
                    {t("users.permsModal.subtitle", { name: user.username })}
                  </p>
                </div>
                <motion.button
                  onClick={onClose}
                  disabled={saving}
                  whileTap={{ scale: 0.9 }}
                  className="shrink-0 rounded-lg p-1.5 text-ui-text-muted transition-colors hover:bg-ui-front"
                >
                  <IoClose className="text-xl" />
                </motion.button>
              </div>

              <div className="flex w-full flex-col gap-3">
                <SwitchRow
                  checked={form.can_upload}
                  label={t("users.canUpload")}
                  onToggle={(value) => onFormChange({ ...form, can_upload: value })}
                />
                <SwitchRow
                  checked={form.can_delete_own_files}
                  label={t("users.canDelete")}
                  onToggle={(value) => onFormChange({ ...form, can_delete_own_files: value })}
                />
                <SwitchRow
                  checked={form.has_upload_limits}
                  label={t("users.hasLimits")}
                  onToggle={(value) => onFormChange({ ...form, has_upload_limits: value })}
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
                      onFormChange({ ...form, upload_limit: e.target.value.replace(/\D/g, "") })
                    }
                    placeholder={t("users.uploadLimitPlaceholder")}
                  />
                </div>
              </div>

              <div className="flex w-full gap-3 pt-2">
                <motion.button
                  onClick={onClose}
                  disabled={saving}
                  whileTap={!saving ? { scale: 0.95 } : undefined}
                  className="flex flex-1 items-center justify-center rounded-full border-2 border-ui-border bg-ui-front px-4 py-2 font-body text-sm font-semibold text-ui-text transition-all hover:border-ui-primary disabled:opacity-50"
                >
                  {t("users.cancel")}
                </motion.button>
                <motion.button
                  onClick={onSave}
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
            </FloatingContainer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
