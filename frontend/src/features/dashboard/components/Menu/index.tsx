/**
 * Sidebar menu for the dashboard.
 * Highlights the active route and hides admin-only items for visitors.
 */

import { type FC, useState, useEffect } from "react"
import { useLocation } from "react-router-dom"

import { FolderlanSvg } from "@shared/components/FolderlanSvg"
import MenuLink from "./components/MenuLink"

import { TiUploadOutline, TiDownloadOutline, TiUserOutline } from "react-icons/ti"
import { FiSettings } from "react-icons/fi"
import type { IconType } from "react-icons"

import { useI18n } from "@i18n/context/I18nContext"

export type View = "upload" | "download" | "config" | "users"

interface MenuOption {
  name: View
  labelKey: string
  icon: IconType
  adminOnly?: boolean
}

interface MenuProps {
  basePath?: string
  isOwner?: boolean
}

const OPTIONS: MenuOption[] = [
  { name: "upload", labelKey: "menu.upload", icon: TiUploadOutline },
  { name: "download", labelKey: "menu.download", icon: TiDownloadOutline },
  { name: "config", labelKey: "menu.config", icon: FiSettings },
  { name: "users", labelKey: "menu.users", icon: TiUserOutline, adminOnly: true },
]

export const Menu: FC<MenuProps> = ({ basePath = "/dashboard", isOwner = false }) => {
  const [activeView, setActiveView] = useState<View | null>(null)
  const location = useLocation()
  const { t } = useI18n()

  useEffect(() => {
    const match = OPTIONS.find((opt) => location.pathname.startsWith(`${basePath}/${opt.name}`))
    setActiveView(match?.name ?? null)
  }, [location.pathname, basePath])

  const visibleOptions = OPTIONS.filter((opt) => !opt.adminOnly || isOwner)

  return (
    <aside className="stagger-group grid grid-rows-[auto_1fr_auto] border-r border-ui-border bg-ui-base">
      <header className="flex w-full flex-col gap-3 px-8 pb-6 pt-8">
        <FolderlanSvg className="w-20 text-ui-text opacity-80" />
        <h1 className="font-heading text-2xl font-extrabold tracking-tight text-ui-text">
          Folderlan
        </h1>
      </header>

      <section className="flex flex-col gap-3 px-4 pt-2">
        <h2 className="px-4 font-body text-[11px] font-bold uppercase tracking-widest text-ui-text-muted">
          {t("menu.title")}
        </h2>
        <nav>
          <ul className="stagger-group flex flex-col gap-1.5">
            {visibleOptions.map((option) => (
              <MenuLink
                key={option.name}
                to={`${basePath}/${option.name}`}
                icon={option.icon}
                label={t(option.labelKey)}
                isActive={activeView === option.name}
              />
            ))}
          </ul>
        </nav>
      </section>

      <div className="flex px-8 pb-6 pt-4">
        <span className="rounded-full bg-ui-front px-3 py-1 font-body text-[11px] font-semibold text-ui-text-muted shadow-sm">
          v{import.meta.env.APP_VERSION}
        </span>
      </div>
    </aside>
  )
}

export default Menu
