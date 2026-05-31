/**
 * Sidebar menu for the dashboard.
 * Highlights the active route and hides admin-only items for visitors.
 */

import { type FC, useState, useEffect } from "react"
import { useLocation } from "react-router-dom" // Link ya no se importa

import { FolderlanSvg } from "@shared/components/FolderlanSvg"
import MenuLink from "./components/MenuLink"

import { TiUploadOutline, TiDownloadOutline, TiUserOutline } from "react-icons/ti"
import { FiSettings } from "react-icons/fi"
import type { IconType } from "react-icons"

export type View = "upload" | "download" | "config" | "users"

interface MenuOption {
  name: View
  label: string
  icon: IconType
  adminOnly?: boolean
}

interface MenuProps {
  basePath?: string
  isOwner?: boolean
}

const OPTIONS: MenuOption[] = [
  { name: "upload", label: "Upload", icon: TiUploadOutline },
  { name: "download", label: "Download", icon: TiDownloadOutline },
  { name: "config", label: "Config", icon: FiSettings },
  { name: "users", label: "Users", icon: TiUserOutline, adminOnly: true },
]

export const Menu: FC<MenuProps> = ({ basePath = "/dashboard", isOwner = false }) => {
  const [activeView, setActiveView] = useState<View | null>(null)
  const location = useLocation()

  useEffect(() => {
    const match = OPTIONS.find((opt) => location.pathname.startsWith(`${basePath}/${opt.name}`))
    setActiveView(match?.name ?? null)
  }, [location.pathname, basePath])

  const visibleOptions = OPTIONS.filter((opt) => !opt.adminOnly || isOwner)

  return (
    <aside className="stagger-group grid grid-rows-[auto_1fr_auto] border-r border-ui-border bg-ui-base">
      <header className="flex w-full flex-col gap-4 p-8">
        <FolderlanSvg className="w-20 text-ui-text opacity-80" />
        <h1 className="pt-3 font-heading text-3xl font-bold text-ui-text">Folderlan</h1>
      </header>

      <section className="flex flex-col gap-4 px-4">
        <h1 className="px-4 font-body text-sm font-bold tracking-wide text-ui-text-muted">Menu</h1>
        <nav>
          <ul className="stagger-group flex flex-col gap-4">
            {visibleOptions.map((option) => (
              <MenuLink
                key={option.name}
                to={`${basePath}/${option.name}`}
                icon={option.icon}
                label={option.label}
                isActive={activeView === option.name}
              />
            ))}
          </ul>
        </nav>
      </section>

      <div className="flex p-8">
        <span className="font-body text-xs text-ui-text-muted">v1.0.0</span>
      </div>
    </aside>
  )
}

export default Menu
