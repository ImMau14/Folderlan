/**
 * UserTable — owner-only list of users.
 *
 * Renders a desktop table and a mobile card list of the fetched users with
 * animated enter/exit transitions. Each row shows avatar, username, role,
 * status, permission chips and per-user actions (activate/deactivate, edit
 * permissions, delete); the owner row is protected from the destructive ones.
 */
import { AnimatePresence, motion } from "framer-motion"
import { FaBan, FaCheck, FaGear, FaTrash, FaUser } from "react-icons/fa6"
import clsx from "clsx"

import { useI18n } from "@i18n/context/I18nContext"
import type { User } from "@shared/utils/ApiClient/types"
import formatBytes from "@shared/utils/formatBytes"
import { formatSqliteDatetime } from "@shared/utils/formatDatetime"
import FloatingContainer from "../../components/FloatingContainer"

interface UserTableProps {
  users: User[]
  loading: boolean
  busyId: number | null
  onToggle: (user: User) => void
  onEditPerms: (user: User) => void
  onDelete: (user: User) => void
}

interface ActionButtonProps {
  action: React.ReactNode
  title: string
  disabled?: boolean
  className?: string
  onClick: () => void
}

function ActionButton({ action, title, disabled, className, onClick }: ActionButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? undefined : { scale: 1.1 }}
      whileTap={disabled ? undefined : { scale: 0.9 }}
      transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
      className={clsx(
        "cursor-pointer rounded-lg p-2 opacity-100 transition-all disabled:cursor-not-allowed disabled:opacity-40",
        className
      )}
      title={title}
    >
      {action}
    </motion.button>
  )
}

function PermChip({ label, on }: { label: string; on: boolean }) {
  return (
    <span
      title={label}
      className={clsx(
        "rounded-lg px-2.5 py-1 font-body text-xs font-semibold",
        on ? "bg-ui-success/15 text-ui-success" : "bg-ui-front text-ui-text-muted/60"
      )}
    >
      {label}
    </span>
  )
}

export default function UserTable({
  users,
  loading,
  busyId,
  onToggle,
  onEditPerms,
  onDelete,
}: UserTableProps) {
  const { t } = useI18n()

  const isOwner = (user: User) => user.role === "owner"

  return (
    <FloatingContainer
      className={clsx(
        "w-full border border-ui-border",
        loading && users.length === 0 ? "min-h-[300px]" : ""
      )}
    >
      {loading && users.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-ui-border border-t-ui-primary" />
          <p className="font-body text-sm font-medium text-ui-text-muted">
            {t("users.table.loading")}
          </p>
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <FaUser className="text-3xl text-ui-text-muted/40" />
          <p className="font-heading text-lg font-bold text-ui-text">{t("users.table.noUsers")}</p>
          <p className="font-body text-sm text-ui-text-muted">{t("users.table.noUsersDesc")}</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden w-full overflow-x-auto scrollbar scrollbar-thin scrollbar-thumb-ui-border scrollbar-track-transparent md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-ui-border font-body text-xs font-semibold uppercase tracking-wider text-ui-text-muted">
                  <th className="px-4 py-3.5 text-left">{t("users.table.user")}</th>
                  <th className="px-4 py-3.5 text-left">{t("users.table.role")}</th>
                  <th className="px-4 py-3.5 text-left">{t("users.table.status")}</th>
                  <th className="px-4 py-3.5 text-left">{t("users.table.permissions")}</th>
                  <th className="px-4 py-3.5 text-left">{t("users.table.created")}</th>
                  <th className="px-4 py-3.5 text-right">{t("users.table.actions")}</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout">
                  {users.map((user, idx) => (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.25, delay: idx * 0.03, ease: [0.2, 0, 0, 1] }}
                      layout
                      className={clsx(
                        "group border-ui-border-muted transition-colors hover:bg-ui-front/70",
                        idx === users.length - 1 ? "" : "border-b"
                      )}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ui-border bg-ui-front font-heading text-xs font-bold text-ui-primary">
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                          <span
                            className="truncate font-body text-sm font-medium text-ui-text"
                            title={user.username}
                          >
                            {user.username}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={clsx(
                            "inline-block rounded-lg px-2.5 py-1 font-body text-xs font-semibold",
                            isOwner(user)
                              ? "bg-ui-primary/15 text-ui-primary"
                              : "bg-ui-front text-ui-text-muted"
                          )}
                        >
                          {t(`users.role.${user.role}`)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={clsx(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-body text-xs font-semibold",
                            user.is_active
                              ? "bg-ui-success/15 text-ui-success"
                              : "bg-ui-danger/10 text-ui-danger"
                          )}
                        >
                          <span
                            className={clsx(
                              "h-1.5 w-1.5 rounded-full",
                              user.is_active ? "bg-ui-success" : "bg-ui-danger"
                            )}
                          />
                          {user.is_active ? t("users.status.active") : t("users.status.inactive")}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <PermChip label={t("users.canUpload")} on={user.can_upload} />
                          <PermChip label={t("users.canDelete")} on={user.can_delete_own_files} />
                          {user.has_upload_limits ? (
                            <span className="rounded-lg bg-ui-front px-2.5 py-1 font-body text-xs font-semibold text-ui-text-muted">
                              {t("users.limitOf", { size: formatBytes(user.upload_limit) })}
                            </span>
                          ) : (
                            <span className="rounded-lg bg-ui-front px-2.5 py-1 font-body text-xs font-semibold text-ui-text-muted">
                              {t("users.noLimit")}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 font-body text-sm text-ui-text-muted">
                        {formatSqliteDatetime(user.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <ActionButton
                            disabled={isOwner(user) || busyId === user.id}
                            onClick={() => onToggle(user)}
                            className={
                              user.is_active
                                ? "text-ui-success hover:bg-ui-front"
                                : "text-ui-text-muted hover:bg-ui-front"
                            }
                            title={
                              user.is_active
                                ? t("users.actions.deactivate")
                                : t("users.actions.activate")
                            }
                            action={
                              user.is_active ? (
                                <FaCheck className="text-sm" />
                              ) : (
                                <FaBan className="text-sm" />
                              )
                            }
                          />
                          <ActionButton
                            disabled={busyId === user.id}
                            onClick={() => onEditPerms(user)}
                            className="text-ui-info hover:bg-ui-front"
                            title={t("users.actions.perms")}
                            action={<FaGear className="text-sm" />}
                          />
                          <ActionButton
                            disabled={isOwner(user) || busyId === user.id}
                            onClick={() => onDelete(user)}
                            className="text-ui-danger hover:bg-ui-front"
                            title={t("users.actions.delete")}
                            action={<FaTrash className="text-sm" />}
                          />
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="flex w-full flex-col gap-2 md:hidden">
            <AnimatePresence mode="popLayout">
              {users.map((user, idx) => (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25, delay: idx * 0.03, ease: [0.2, 0, 0, 1] }}
                  layout
                  className="flex items-center gap-3 rounded-xl border border-ui-border-muted bg-ui-front/50 p-3 transition-colors hover:bg-ui-front"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ui-border bg-ui-front font-heading text-xs font-bold text-ui-primary">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="truncate font-body text-sm font-medium text-ui-text"
                          title={user.username}
                        >
                          {user.username}
                        </span>
                        <span
                          className={clsx(
                            "h-1.5 w-1.5 shrink-0 rounded-full",
                            user.is_active ? "bg-ui-success" : "bg-ui-danger"
                          )}
                        />
                      </div>
                      <div className="mt-0.5 truncate font-body text-xs font-medium text-ui-text-muted">
                        {t(`users.role.${user.role}`)} ·{" "}
                        {user.is_active ? t("users.status.active") : t("users.status.inactive")} ·{" "}
                        {formatSqliteDatetime(user.created_at)}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <ActionButton
                      disabled={isOwner(user) || busyId === user.id}
                      onClick={() => onToggle(user)}
                      className={
                        user.is_active ? "text-ui-success" : "text-ui-text-muted hover:text-ui-text"
                      }
                      title={
                        user.is_active ? t("users.actions.deactivate") : t("users.actions.activate")
                      }
                      action={
                        user.is_active ? (
                          <FaCheck className="text-sm" />
                        ) : (
                          <FaBan className="text-sm" />
                        )
                      }
                    />
                    <ActionButton
                      disabled={busyId === user.id}
                      onClick={() => onEditPerms(user)}
                      className="text-ui-info hover:bg-ui-front"
                      title={t("users.actions.perms")}
                      action={<FaGear className="text-sm" />}
                    />
                    <ActionButton
                      disabled={isOwner(user) || busyId === user.id}
                      onClick={() => onDelete(user)}
                      className="text-ui-danger hover:bg-ui-front"
                      title={t("users.actions.delete")}
                      action={<FaTrash className="text-sm" />}
                    />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      )}
    </FloatingContainer>
  )
}
