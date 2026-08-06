/**
 * SummarySection — overview cards with storage and quota statistics.
 *
 * Renders stat cards for accessible files, used space, active users (owner
 * only) and the upload-quota usage. The quota card derives its tone from
 * how full the quota is; every card animates in with a slight stagger.
 */
import type { ReactNode } from "react"
import { motion } from "framer-motion"
import { FaFolderOpen, FaHardDrive, FaUsers, FaGaugeHigh, FaFileLines } from "react-icons/fa6"
import clsx from "clsx"

import { useI18n } from "@i18n/context/I18nContext"
import { formatBytes } from "@shared/utils/formatBytes"
import FloatingContainer from "../../components/FloatingContainer"
import SectionHeader from "./SectionHeader"

export interface SummaryStats {
  accessibleCount: number
  accessibleBytes: number
  myBytes: number
  activeUsers: number | null
  isOwner: boolean
  hasQuota: boolean
  quotaLimit: number
}

interface StatCardProps {
  icon: ReactNode
  label: string
  value: string
  sub?: string
  tone: "primary" | "secondary" | "success" | "warning" | "danger" | "info"
}

const TONE_CLASSES: Record<StatCardProps["tone"], string> = {
  primary: "text-ui-primary bg-ui-primary/10",
  secondary: "text-ui-secondary bg-ui-secondary/10",
  success: "text-ui-success bg-ui-success/10",
  warning: "text-ui-warning bg-ui-warning/10",
  danger: "text-ui-danger bg-ui-danger/10",
  info: "text-ui-info bg-ui-info/10",
}

function StatCard({ icon, label, value, sub, tone }: StatCardProps) {
  return (
    <div className="group flex flex-col gap-3 rounded-2xl border border-ui-border-muted bg-ui-front p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-ui-primary/30 hover:shadow-md">
      <div
        className={clsx(
          "flex h-10 w-10 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-105",
          TONE_CLASSES[tone]
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate font-body text-xs font-semibold uppercase tracking-wider text-ui-text-muted">
          {label}
        </p>
        <p className="mt-0.5 truncate font-heading text-xl font-bold tabular-nums tracking-tight text-ui-text">
          {value}
        </p>
        {sub ? (
          <p className="truncate font-body text-xs font-medium text-ui-text-muted">{sub}</p>
        ) : null}
      </div>
    </div>
  )
}

interface SummarySectionProps {
  stats: SummaryStats
  loading?: boolean
}

export default function SummarySection({ stats, loading = false }: SummarySectionProps) {
  const { t } = useI18n()

  const quotaUsed = stats.hasQuota ? Math.min(stats.myBytes, stats.quotaLimit) : stats.myBytes
  const quotaPct =
    stats.hasQuota && stats.quotaLimit > 0 ? Math.round((quotaUsed / stats.quotaLimit) * 100) : 0
  const quotaTone: StatCardProps["tone"] =
    quotaPct > 90 ? "danger" : quotaPct > 70 ? "warning" : "secondary"

  const cards: StatCardProps[] = [
    {
      icon: <FaFolderOpen className="text-sm" />,
      label: t("config.summary.files"),
      value: loading ? "—" : String(stats.accessibleCount),
      sub: loading ? undefined : formatBytes(stats.accessibleBytes),
      tone: "primary",
    },
    {
      icon: <FaHardDrive className="text-sm" />,
      label: stats.isOwner ? t("config.summary.space") : t("config.summary.mySpace"),
      value: loading ? "—" : formatBytes(stats.isOwner ? stats.accessibleBytes : stats.myBytes),
      sub: loading || stats.isOwner ? undefined : t("config.summary.mySpaceDesc"),
      tone: "success",
    },
    ...(stats.isOwner
      ? [
          {
            icon: <FaUsers className="text-sm" />,
            label: t("config.summary.activeUsers"),
            value: loading || stats.activeUsers === null ? "—" : String(stats.activeUsers),
            tone: "info" as const,
          },
        ]
      : []),
    {
      icon: <FaGaugeHigh className="text-sm" />,
      label: t("config.summary.quota"),
      value: loading
        ? "—"
        : stats.hasQuota
          ? `${formatBytes(quotaUsed)} / ${formatBytes(stats.quotaLimit)}`
          : t("config.summary.noLimit"),
      sub: loading || !stats.hasQuota ? undefined : `${quotaPct}%`,
      tone: quotaTone,
    },
  ]

  return (
    <FloatingContainer className="w-full !items-stretch border border-ui-border !p-5 sm:!p-6">
      <div className="flex w-full flex-col gap-5">
        <SectionHeader
          icon={<FaFileLines className="text-xl text-ui-info" />}
          title={t("config.summary.title")}
          subtitle={t("config.summary.subtitle")}
        />

        <div
          className={clsx(
            "grid w-full grid-cols-1 gap-3 xs:grid-cols-2",
            stats.isOwner ? "lg:grid-cols-4" : "lg:grid-cols-3"
          )}
        >
          {cards.map((card, idx) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: idx * 0.05, ease: [0.2, 0, 0, 1] }}
            >
              <StatCard {...card} />
            </motion.div>
          ))}
        </div>
      </div>
    </FloatingContainer>
  )
}
