// 404 Not Found page component with random message and animated elements

import { motion } from "framer-motion"
import { IoIosWarning } from "react-icons/io"
import React from "react"
import { Link } from "react-router-dom"
import { Button } from "@components/Button"
import notFoundImage from "@assets/homerochino.webp"
import { useI18n } from "@i18n/I18nProvider"
import { setThemeColor } from "@utils/setThemeColor"

export const NotFoundPage: React.FC = () => {
  const { t } = useI18n()

  // Set page theme color on component mount
  React.useEffect(() => {
    setThemeColor("#f5f6f7")
  }, [])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 text-center text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <img src={notFoundImage} alt={t("notFound.altDescription")} className="mb-8 w-72" />
      <h1 className="mb-4 text-4xl font-bold">{t("notFound.title")}</h1>
      <p className="mb-6 max-w-md text-base text-slate-600 dark:text-slate-300">
        {t("notFound.description")}
      </p>
      <p className="mb-8 max-w-md text-base text-slate-600 dark:text-slate-300">
        {t("notFound.altDescription")}
      </p>
      <Link to="/">
        <Button color="green">{t("global.appName")}</Button>
      </Link>
    </div>
  )
}
