// 404 Not Found page component with random message and animated elements

import { IoIosWarning } from "react-icons/io"
import { type FC, useMemo } from "react"
import { Link } from "react-router-dom"
import Button from "@shared/components/Button"
import notFoundImage from "@shared/assets/homerochino.webp"
import { useI18n } from "@i18n/context/I18nContext"
import FolderlanSvg from "@shared/components/FolderlanSvg"

export const NotFoundPage: FC = () => {
  const { t } = useI18n()
  const randomNum = useMemo(() => Math.floor(Math.random() * 10) + 1 === 1, [])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 text-center text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      {randomNum ? (
        <img src={notFoundImage} alt={t("notFound.altDescription")} className="h-48" />
      ) : (
        <IoIosWarning className="text-5xl text-yellow-500" />
      )}

      <h1 className="text-4xl font-bold">{t("notFound.title")}</h1>

      <p className="max-w-md text-base text-slate-600 dark:text-slate-300">
        {randomNum ? t("notFound.altDescription") : t("notFound.description")}
      </p>

      <Link to="/">
        <Button color="green" className="flex items-center justify-center gap-2">
          <FolderlanSvg className="w-4" />
          {t("global.appName")}
        </Button>
      </Link>
    </div>
  )
}

export default NotFoundPage
