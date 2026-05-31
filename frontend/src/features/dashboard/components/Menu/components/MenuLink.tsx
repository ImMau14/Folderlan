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
        className={`flex w-full items-center gap-3 rounded-lg px-4 py-2 font-body text-sm transition-colors ${
          isActive
            ? "bg-ui-primary/20 text-ui-primary"
            : "text-ui-text-muted hover:bg-ui-front hover:text-ui-text"
        }`}
      >
        <Icon className="h-5 w-5" />
        <span>{label}</span>
      </Link>
    </li>
  )
}
