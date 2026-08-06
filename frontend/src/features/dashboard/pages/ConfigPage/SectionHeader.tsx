/**
 * SectionHeader — icon + title + subtitle block used to open cards.
 *
 * Small presentational helper shared across the ConfigPage sections to
 * keep the icon badge, heading and description layout consistent.
 */
import type { ReactNode } from "react"

interface SectionHeaderProps {
  icon: ReactNode
  title: string
  subtitle: string
}

export default function SectionHeader({ icon, title, subtitle }: SectionHeaderProps) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-ui-border-muted bg-ui-front">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-heading text-lg font-bold text-ui-text">{title}</h3>
        <p className="mt-1 font-body text-sm font-medium text-ui-text-muted">{subtitle}</p>
      </div>
    </div>
  )
}
