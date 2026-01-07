import { type FC, useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'

import { FolderlanSvg } from '@components/FolderlanSvg'

import MenuLink from './components/MenuLink'

import { TiUploadOutline, TiFolder, TiUserOutline } from 'react-icons/ti'
import { FiSettings } from 'react-icons/fi'

import type { IconType } from 'react-icons'

export type OptionsType = 'Upload' | 'Files' | 'User' | 'Settings'

export type MenuOptionType = {
  name: OptionsType
  icon: IconType
}

const PATH_BY_OPTION: Record<OptionsType, string> = {
  Upload: '/upload',
  Files: '/files',
  User: '/user',
  Settings: '/settings',
}

const joinPaths = (base: string, path: string) => `${base.replace(/\/$/, '')}${path}`

type MenuProps = {
  basePath?: string
}

export const Menu: FC<MenuProps> = ({ basePath = '/dashboard' }) => {
  const [focusedOption, setFocusedOption] = useState<OptionsType | null>(null)
  const location = useLocation()

  useEffect(() => {
    const match = (Object.keys(PATH_BY_OPTION) as OptionsType[]).find((opt) =>
      location.pathname.startsWith(joinPaths(basePath, PATH_BY_OPTION[opt]))
    )
    if (match) setFocusedOption(match)
  }, [location.pathname, basePath])

  const options: MenuOptionType[] = [
    { name: 'Upload', icon: TiUploadOutline },
    { name: 'Files', icon: TiFolder },
    { name: 'User', icon: TiUserOutline },
    { name: 'Settings', icon: FiSettings },
  ]

  return (
    <aside className="stagger-group grid grid-rows-[auto_1fr_auto] bg-ui-base">
      <header className="flex w-full flex-col gap-4 p-8">
        <FolderlanSvg className="w-20 text-ui-text opacity-80" />
        <h1 className="pt-3 font-heading text-3xl tracking-wide text-ui-text">Folderlan</h1>
      </header>

      <section className="flex flex-col gap-4 px-4">
        <h1 className="px-4 font-body text-sm font-semibold tracking-wide text-ui-text-muted">
          Menu
        </h1>
        <nav>
          <ul className="stagger-group flex flex-col gap-4">
            {options.map((link, index) => (
              <MenuLink
                option={link}
                focused={focusedOption}
                setFocused={setFocusedOption}
                basePath={basePath}
                key={index}
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
