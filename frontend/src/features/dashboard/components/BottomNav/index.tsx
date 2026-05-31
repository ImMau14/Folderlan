/**
 * Bottom navigation bar for mobile dashboard.
 * Uses the same design tokens and active/hover logic as the sidebar.
 */

import { type FC, useState, useEffect } from "react"
import { useLocation, useNavigate } from "react-router-dom"

import { TiUploadOutline, TiDownloadOutline, TiUserOutline } from "react-icons/ti"
import { FiSettings } from "react-icons/fi"
import type { IconType } from "react-icons"

type View = "upload" | "download" | "config" | "users"

interface NavItem {
  name: View
  label: string
  icon: IconType
  adminOnly?: boolean
}

const ITEMS: NavItem[] = [
  { name: "upload", label: "Upload", icon: TiUploadOutline },
  { name: "download", label: "Download", icon: TiDownloadOutline },
  { name: "config", label: "Config", icon: FiSettings },
  { name: "users", label: "Users", icon: TiUserOutline, adminOnly: true },
]

interface BottomNavProps {
  isOwner?: boolean
}

export const BottomNav: FC<BottomNavProps> = ({ isOwner = false }) => {
  const [activeView, setActiveView] = useState<View | null>(null)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const match = ITEMS.find((item) => location.pathname.startsWith(`/dashboard/${item.name}`))
    setActiveView(match?.name ?? null)
  }, [location.pathname])

  const visibleItems = ITEMS.filter((item) => !item.adminOnly || isOwner)

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-ui-border bg-ui-base">
      <ul className="flex h-16 items-center justify-around">
        {visibleItems.map((item) => {
          const isActive = activeView === item.name
          const Icon = item.icon
          return (
            <li key={item.name} className="flex-1">
              <button
                onClick={() => navigate(`/dashboard/${item.name}`)}
                className={`flex w-full flex-col items-center justify-center gap-1 py-1 transition-colors ${
                  isActive ? "text-ui-primary" : "text-ui-text-muted hover:text-ui-text"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="font-body text-xs">{item.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export default BottomNav
