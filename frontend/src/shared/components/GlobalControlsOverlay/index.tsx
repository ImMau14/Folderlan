// Global controls overlay component for theme and language switching.

import { type FC } from "react"
import clsx from "clsx"
import { LanguageSwitcher } from "@i18n/components/LanguageSwitcher"
import { ThemeToggle } from "@theme/components/ThemeToggle"

interface GlobalControlsOverlayProps {
  className?: string
}

export const GlobalControlsOverlay: FC<GlobalControlsOverlayProps> = ({ className }) => {
  return (
    <div className={clsx("fixed right-4 top-4 z-[60] md:right-6 md:top-6", className)}>
      <div className="flex items-center gap-2 rounded-full border border-white/50 bg-white/85 px-2.5 py-2 shadow-lg shadow-slate-900/15 backdrop-blur-md transition dark:border-white/10 dark:bg-slate-900/70">
        <LanguageSwitcher variant="mobile" />
        <ThemeToggle variant="icon" />
      </div>
    </div>
  )
}

export default GlobalControlsOverlay
