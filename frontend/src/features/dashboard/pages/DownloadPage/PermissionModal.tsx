import { AnimatePresence, motion } from "framer-motion"
import { FaTimes, FaUserPlus, FaUserMinus } from "react-icons/fa"

import { useI18n } from "@i18n/context/I18nContext"
import type { FilePermission, User } from "@shared/utils/ApiClient/types"
import FloatingContainer from "../../components/FloatingContainer"

interface PermissionModalProps {
  open: boolean
  fileName: string
  permissions: FilePermission[]
  users: User[]
  loadingPerms: boolean
  grantUserId: string
  grantLevel: "viewer" | "collaborator"
  onGrantUserIdChange: (value: string) => void
  onGrantLevelChange: (value: "viewer" | "collaborator") => void
  onGrant: () => void
  onRevoke: (userId: number) => void
  onClose: () => void
}

export default function PermissionModal({
  open,
  fileName,
  permissions,
  users,
  loadingPerms,
  grantUserId,
  grantLevel,
  onGrantUserIdChange,
  onGrantLevelChange,
  onGrant,
  onRevoke,
  onClose,
}: PermissionModalProps) {
  const { t } = useI18n()

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="perm-overlay"
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
            <FloatingContainer className="max-h-[80vh] w-full max-w-lg border border-ui-border">
              <div className="flex w-full items-center justify-between">
                <h3 className="font-heading text-lg font-bold text-ui-text">
                  {t("download.permissions.title")}
                </h3>
                <motion.button
                  onClick={onClose}
                  whileTap={{ scale: 0.9 }}
                  className="rounded-full p-2 text-ui-text-muted transition-colors hover:bg-ui-front"
                >
                  <FaTimes />
                </motion.button>
              </div>
              <p className="w-full max-w-full truncate text-left font-body text-sm text-ui-text-muted">
                {fileName}
              </p>

              <div className="w-full">
                <h4 className="mb-2 font-body text-xs font-semibold uppercase tracking-wider text-ui-text-muted">
                  {t("download.permissions.grantTitle")}
                </h4>
                <div className="flex gap-2">
                  <select
                    value={grantUserId}
                    onChange={(e) => onGrantUserIdChange(e.target.value)}
                    className="min-w-0 flex-1 rounded-full border-2 border-ui-border bg-ui-front px-3 py-2 font-body text-sm text-ui-text transition-colors focus:border-ui-primary focus:outline-none focus:ring-2 focus:ring-ui-primary"
                  >
                    <option value="">{t("download.permissions.selectUser")}</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.username}
                      </option>
                    ))}
                  </select>
                  <select
                    value={grantLevel}
                    onChange={(e) =>
                      onGrantLevelChange(e.target.value as "viewer" | "collaborator")
                    }
                    className="rounded-full border-2 border-ui-border bg-ui-front px-3 py-2 font-body text-sm text-ui-text transition-colors focus:border-ui-primary focus:outline-none focus:ring-2 focus:ring-ui-primary"
                  >
                    <option value="viewer">{t("download.permissions.viewer")}</option>
                    <option value="collaborator">{t("download.permissions.collaborator")}</option>
                  </select>
                  <motion.button
                    onClick={onGrant}
                    disabled={!grantUserId}
                    whileTap={grantUserId ? { scale: 0.95 } : undefined}
                    className="flex items-center gap-2 rounded-full bg-ui-primary px-4 py-2 font-body text-sm font-semibold text-ui-highlight transition-all hover:bg-ui-primary-hover disabled:opacity-50 dark:text-ui-base"
                  >
                    <FaUserPlus />
                    {t("download.permissions.grantButton")}
                  </motion.button>
                </div>
              </div>

              <div className="w-full">
                <h4 className="mb-2 font-body text-xs font-semibold uppercase tracking-wider text-ui-text-muted">
                  {t("download.permissions.title")}
                </h4>
                <div className="min-h-[100px]">
                  {loadingPerms ? (
                    <div className="flex justify-center py-8">
                      <span className="h-6 w-6 animate-spin rounded-full border-4 border-ui-border border-t-ui-primary" />
                    </div>
                  ) : permissions.length === 0 ? (
                    <p className="py-4 text-center font-body text-sm text-ui-text-muted">
                      {t("download.permissions.noPerms")}
                    </p>
                  ) : (
                    <div className="max-h-[200px] overflow-y-auto scrollbar scrollbar-thin scrollbar-thumb-ui-border scrollbar-track-transparent">
                      {permissions.map((p) => (
                        <div
                          key={p.user_id}
                          className="flex items-center justify-between rounded-xl border border-ui-border-muted px-3 py-2"
                        >
                          <div className="flex flex-col">
                            <span className="font-body text-sm font-medium text-ui-text">
                              {p.username ?? `User #${p.user_id}`}
                            </span>
                            <span className="font-body text-xs text-ui-text-muted">
                              {p.access_level === "collaborator"
                                ? t("download.permissions.collaborator")
                                : t("download.permissions.viewer")}
                            </span>
                          </div>
                          <motion.button
                            onClick={() => onRevoke(p.user_id)}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            className="hover:bg-ui-danger/10 rounded-full p-2 text-ui-danger transition-colors"
                            title={t("download.permissions.revokeButton")}
                          >
                            <FaUserMinus />
                          </motion.button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <motion.button
                onClick={onClose}
                whileTap={{ scale: 0.95 }}
                className="mt-2 w-full rounded-full border-2 border-ui-border bg-ui-front px-4 py-2 font-body text-sm font-semibold text-ui-text transition-all hover:border-ui-primary"
              >
                {t("download.permissions.close")}
              </motion.button>
            </FloatingContainer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
