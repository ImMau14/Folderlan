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
      <div className="glass-smoked flex items-center gap-2 rounded-full border border-ui-border-muted bg-ui-base/90 px-2.5 py-2 backdrop-blur-lg transition">
        <LanguageSwitcher variant="mobile" />
        <ThemeToggle variant="icon" />
      </div>
    </div>
  )
}

export default GlobalControlsOverlay
