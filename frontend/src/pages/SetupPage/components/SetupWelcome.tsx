// SetupWelcome - Presentational welcome screen for initial setup.
// Small component that shows app logo and start button.

import { type FC } from "react"
import { FaArrowRightToBracket } from "react-icons/fa6"
import { motion, type Transition } from "framer-motion"

import { FolderlanSvg } from "@components/FolderlanSvg"
import { Button } from "@components/Button"
import { useI18n } from "@contexts/I18nContext"

type Props = {
  onStart: () => void
  cardTransition: Transition
}

const SetupWelcome: FC<Props> = ({ onStart, cardTransition }) => {
  const { t } = useI18n()

  return (
    <motion.main
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 12 }}
      transition={cardTransition}
      className="absolute flex w-[90%] flex-col items-center gap-6 rounded-2xl border border-slate-200/80 bg-white/80 p-10 shadow-2xl shadow-slate-900/20 backdrop-blur-md md:w-[600px] dark:border-slate-700/60 dark:bg-slate-900/70 dark:shadow-slate-900/50"
    >
      <header className="flex flex-col items-center gap-6">
        <FolderlanSvg className="h-24 text-gray-900 dark:text-slate-100" />
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-center font-heading text-3xl font-semibold text-gray-900 dark:text-slate-50">
            {t("setup.welcomeTitle")}
          </h1>
          <p className="text-center font-body text-gray-600 dark:text-slate-300">
            {t("setup.welcomeDescription")}
          </p>
        </div>
      </header>

      <Button
        color="green"
        className="flex w-full flex-row items-center justify-center gap-2"
        onClick={onStart}
      >
        <FaArrowRightToBracket />
        {t("setup.startButton")}
      </Button>
    </motion.main>
  )
}

export default SetupWelcome
