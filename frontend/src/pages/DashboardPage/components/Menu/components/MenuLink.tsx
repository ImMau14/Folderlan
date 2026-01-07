import { useMemo, type FC } from 'react'
import clsx from 'clsx'
import { useNavigate } from 'react-router-dom'

import type { OptionsType, MenuOptionType } from '../'

interface MenuLinkProps {
  option: MenuOptionType
  focused: OptionsType | null
  setFocused: (name: OptionsType) => void
  basePath?: string
}

const PATH_BY_OPTION: Record<OptionsType, string> = {
  Upload: '/upload',
  Files: '/files',
  User: '/user',
  Settings: '/settings',
}

const joinPaths = (base: string, path: string) => `${base.replace(/\/$/, '')}${path}`

export const MenuLink: FC<MenuLinkProps> = ({ option, focused, setFocused, basePath = '' }) => {
  const navigate = useNavigate()

  const { name, Icon } = { name: option.name, Icon: option.icon }

  const classes = useMemo(
    () =>
      clsx(
        'flex w-full items-center gap-2 rounded-xl px-4 py-2 text-ui-text transition-colors duration-200 ',
        focused === name
          ? 'bg-green-600/10 shadow-sm hover:bg-green-500/10 active:bg-green-400/10'
          : 'hover:bg-ui-front/80'
      ),
    [focused, name]
  )

  const iconClasses = useMemo(
    () =>
      clsx(
        'text-2xl opacity-80 transition-colors duration-200',
        focused === name && 'text-ui-primary'
      ),
    [focused, name]
  )

  const handleClick = () => {
    setFocused(name)
    const target = joinPaths(basePath, PATH_BY_OPTION[name])
    navigate(target)
  }

  return (
    <li>
      <button type="button" className={classes} onClick={handleClick}>
        <Icon className={iconClasses} />
        <span className="font-body text-base font-semibold tracking-wider">{name}</span>
      </button>
    </li>
  )
}

export default MenuLink
