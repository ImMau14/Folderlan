import { AnimatePresence, motion } from "framer-motion"
import { FaUserPlus, FaUserMinus, FaLock } from "react-icons/fa6"
import { IoClose } from "react-icons/io5"

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
            className="w-full max-w-lg"
          >
            <FloatingContainer className="max-h-[85vh] w-full !items-stretch overflow-hidden !p-5 text-left sm:!p-8">
              <div className="flex w-full items-center gap-4 border-b border-ui-border pb-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-ui-border-muted bg-ui-front">
                  <FaLock className="text-xl text-ui-info" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-heading text-lg font-bold text-ui-text">
                    {t("download.permissions.title")}
                  </h3>
                  <p className="truncate font-body text-sm text-ui-text-muted" title={fileName}>
                    {fileName}
                  </p>
                </div>
                <motion.button
                  onClick={onClose}
                  whileTap={{ scale: 0.9 }}
                  className="shrink-0 rounded-lg p-1.5 text-ui-text-muted transition-colors hover:bg-ui-front"
                >
                  <IoClose className="text-xl" />
                </motion.button>
              </div>

              <div className="flex w-full flex-col gap-3">
                <h4 className="font-body text-xs font-semibold uppercase tracking-wider text-ui-text-muted">
                  {t("download.permissions.grantTitle")}
                </h4>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
                    className="rounded-full border-2 border-ui-border bg-ui-front px-3 py-2 font-body text-sm text-ui-text transition-colors focus:border-ui-primary focus:outline-none focus:ring-2 focus:ring-ui-primary sm:w-36"
                  >
                    <option value="viewer">{t("download.permissions.viewer")}</option>
                    <option value="collaborator">{t("download.permissions.collaborator")}</option>
                  </select>
                  <motion.button
                    onClick={onGrant}
                    disabled={!grantUserId}
                    whileTap={grantUserId ? { scale: 0.95 } : undefined}
                    className="flex items-center justify-center gap-2 rounded-full bg-ui-primary px-4 py-2 font-body text-sm font-semibold text-ui-highlight transition-all hover:bg-ui-primary-hover disabled:opacity-50 sm:w-fit dark:text-ui-base"
                  >
                    <FaUserPlus />
                    {t("download.permissions.grantButton")}
                  </motion.button>
                </div>
              </div>

              <div className="flex min-h-0 w-full flex-col gap-3">
                <h4 className="font-body text-xs font-semibold uppercase tracking-wider text-ui-text-muted">
                  {t("download.permissions.currentPerms")}
                </h4>
                <div className="min-h-[120px] flex-1">
                  {loadingPerms ? (
                    <div className="flex justify-center py-10">
                      <span className="h-6 w-6 animate-spin rounded-full border-4 border-ui-border border-t-ui-primary" />
                    </div>
                  ) : permissions.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-10">
                      <FaLock className="text-2xl text-ui-text-muted" />
                      <p className="font-body text-sm text-ui-text-muted">
                        {t("download.permissions.noPerms")}
                      </p>
                    </div>
                  ) : (
                    <div className="-mx-2 flex max-h-[240px] flex-col gap-1.5 overflow-y-auto px-2 scrollbar scrollbar-thin scrollbar-thumb-ui-border scrollbar-track-transparent">
                      {permissions.map((p) => (
                        <div
                          key={p.user_id}
                          className="flex items-center justify-between rounded-xl border border-ui-border-muted px-3 py-2 transition-colors hover:bg-ui-front"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ui-border bg-ui-front font-body text-xs font-bold text-ui-primary">
                              {(p.username ?? `User #${p.user_id}`).charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-body text-sm font-medium text-ui-text">
                                {p.username ?? `User #${p.user_id}`}
                              </p>
                              <p className="font-body text-xs text-ui-text-muted">
                                {p.access_level === "collaborator"
                                  ? t("download.permissions.collaborator")
                                  : t("download.permissions.viewer")}
                              </p>
                            </div>
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
            </FloatingContainer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
