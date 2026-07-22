/**
 * Styled navigation link for the sidebar menu.
 * Uses the project's design tokens (ui-*) for active/hover states.
 */

import { Link } from "react-router-dom"
import type { IconType } from "react-icons"

interface MenuLinkProps {
  to: string
  icon: IconType
  label: string
  isActive: boolean
}

export default function MenuLink({ to, icon: Icon, label, isActive }: MenuLinkProps) {
  return (
    <li>
      <Link
        to={to}
        className={`flex w-full items-center gap-3 rounded-xl px-4 py-2.5 font-body text-sm font-medium transition-all duration-200 ${
          isActive
            ? "bg-ui-primary/15 font-semibold text-ui-primary"
            : "text-ui-text-muted hover:bg-ui-front hover:text-ui-text"
        }`}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span>{label}</span>
      </Link>
    </li>
  )
}
