/**
 * SetupWelcome - Presentational welcome screen for initial setup.
 * Small component that shows app logo and start button.
 * Entrance animation: CSS class "animate-fade-in-up" + "opacity-0".
 * Exit: Framer Motion opacity fade-out.
 */

import { type FC } from "react"
import { FaArrowRightToBracket } from "react-icons/fa6"
import { motion } from "framer-motion"

import { FolderlanSvg } from "@shared/components/FolderlanSvg"
import { Button } from "@shared/components/Button"
import { useI18n } from "@i18n/context/I18nContext"

type Props = {
  onStart: () => void
}

const SetupWelcome: FC<Props> = ({ onStart }) => {
  const { t } = useI18n()

  return (
    <motion.div
      // Exit animation: fades out over 0.25s.
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="flex w-full items-center justify-center"
    >
      <div className="flex w-[90%] animate-fade-in-up flex-col items-center gap-6 rounded-3xl border border-ui-border bg-ui-base p-10 shadow-ui md:w-144">
        <header className="flex flex-col items-center gap-6">
          <FolderlanSvg className="h-20 text-ui-text" />
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-center font-heading text-3xl font-bold text-ui-text">
              {t("setup.welcomeTitle")}
            </h1>
            <p className="text-center font-body text-sm text-ui-text-muted">
              {t("setup.welcomeDescription")}
            </p>
          </div>
        </header>

        <Button color="primary" onClick={onStart}>
          <FaArrowRightToBracket />
          {t("setup.startButton")}
        </Button>
      </div>
    </motion.div>
  )
}

export default SetupWelcome
