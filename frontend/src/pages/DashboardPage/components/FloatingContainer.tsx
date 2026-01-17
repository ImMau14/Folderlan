import { type FC, type ReactNode, useMemo } from 'react'
import clsx from 'clsx'

interface FloatingContainerProps {
  children: ReactNode
  className?: string
}

export const FloatingContainer: FC<FloatingContainerProps> = ({ className, children }) => {
  const classes = useMemo(
    () =>
      clsx(
        'flex flex-col items-center gap-4 rounded-3xl bg-ui-base p-8 shadow-ui-0',
        className ?? ''
      ),
    [className]
  )

  return <div className={classes}>{children}</div>
}

export default FloatingContainer
