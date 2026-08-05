import { motion } from "framer-motion"
import type { ReactNode } from "react"
import {
  FaCircleUser,
  FaCloudArrowUp,
  FaTrashCan,
  FaGaugeHigh,
  FaUserShield,
} from "react-icons/fa6"
import clsx from "clsx"

import { useAuth } from "@auth/context/AuthContext"
import { useI18n } from "@i18n/context/I18nContext"
import { formatBytes } from "@shared/utils/formatBytes"
import FloatingContainer from "../../components/FloatingContainer"
import SectionHeader from "./SectionHeader"

interface AccountSectionProps {
  myBytes: number
}

interface ChipProps {
  icon: ReactNode
  label: string
  ok: boolean
}

function Chip({ icon, label, ok }: ChipProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-body text-xs font-semibold",
        ok
          ? "border-ui-success/30 bg-ui-success/10 text-ui-success"
          : "border-ui-danger/30 bg-ui-danger/10 text-ui-danger"
      )}
    >
      <span className={clsx(ok ? "text-ui-success" : "text-ui-danger")}>{icon}</span>
      {label}
    </span>
  )
}

export default function AccountSection({ myBytes }: AccountSectionProps) {
  const { user } = useAuth()
  const { t } = useI18n()

  if (!user) return null

  const isOwner = user.role === "owner"
  const initial = user.username.charAt(0).toUpperCase()

  const quotaPct =
    user.has_upload_limits && user.upload_limit > 0
      ? Math.round((Math.min(myBytes, user.upload_limit) / user.upload_limit) * 100)
      : 0

  return (
    <FloatingContainer className="h-full w-full !items-stretch border border-ui-border !p-5 sm:!p-6">
      <div className="flex w-full flex-col gap-5">
        <SectionHeader
          icon={<FaCircleUser className="text-xl text-ui-secondary" />}
          title={t("config.account.title")}
          subtitle={t("config.account.subtitle")}
        />

        <div className="flex flex-col gap-5">
          {/* Avatar + nombre + rol */}
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-ui-primary/15 font-heading text-2xl font-extrabold tracking-tight text-ui-primary">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="truncate font-heading text-xl font-bold tracking-tight text-ui-text">
                {user.username}
              </p>
              <span
                className={clsx(
                  "mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-body text-xs font-semibold",
                  isOwner
                    ? "bg-ui-primary/15 text-ui-primary"
                    : "bg-ui-secondary/15 text-ui-secondary"
                )}
              >
                <FaUserShield className="text-[10px]" />
                {isOwner ? t("users.role.owner") : t("users.role.visitor")}
              </span>
            </div>
          </div>

          {/* Permisos / chips (solo para visitantes) */}
          {!isOwner && (
            <div className="flex flex-wrap items-center gap-2">
              <Chip
                icon={<FaCloudArrowUp className="text-xs" />}
                label={t("config.account.canUpload")}
                ok={user.can_upload}
              />
              <Chip
                icon={<FaTrashCan className="text-xs" />}
                label={t("config.account.canDeleteOwn")}
                ok={user.can_delete_own_files}
              />
              <Chip
                icon={<FaGaugeHigh className="text-xs" />}
                label={
                  user.has_upload_limits
                    ? t("config.account.limitsEnabled", { limit: formatBytes(user.upload_limit) })
                    : t("config.account.noLimits")
                }
                ok={user.has_upload_limits ? quotaPct < 100 : true}
              />
            </div>
          )}

          {isOwner && (
            <div className="flex items-center gap-3 rounded-xl border border-ui-primary/20 bg-ui-primary/5 px-4 py-3">
              <FaUserShield className="shrink-0 text-ui-primary" />
              <p className="font-body text-sm font-medium text-ui-text">
                {t("config.account.fullAccess")}
              </p>
            </div>
          )}

          {/* Barra de cuota (si aplica) */}
          {user.has_upload_limits && user.upload_limit > 0 && (
            <div className="flex w-full flex-col gap-2">
              <div className="flex items-center justify-between font-body text-xs font-medium text-ui-text-muted">
                <span>{t("config.account.quotaLabel")}</span>
                <span>
                  {formatBytes(Math.min(myBytes, user.upload_limit))} /{" "}
                  {formatBytes(user.upload_limit)} · {quotaPct}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-ui-border/40">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${quotaPct}%` }}
                  transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
                  className={clsx(
                    "h-full rounded-full",
                    quotaPct > 90
                      ? "bg-ui-danger"
                      : quotaPct > 70
                        ? "bg-ui-warning"
                        : "bg-ui-primary"
                  )}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </FloatingContainer>
  )
}
