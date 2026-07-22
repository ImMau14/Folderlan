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
  const randomNum = useMemo(() => Math.floor(Math.random() * 100) + 1 === 1, [])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ui-back text-center transition-colors">
      {randomNum ? (
        <img src={notFoundImage} alt={t("notFound.altDescription")} className="h-48" />
      ) : (
        <IoIosWarning className="text-5xl text-ui-warning" />
      )}

      <h1 className="font-heading text-4xl font-bold text-ui-text">{t("notFound.title")}</h1>

      <p className="max-w-md font-body text-base text-ui-text-muted">
        {randomNum ? t("notFound.altDescription") : t("notFound.description")}
      </p>

      <Link to="/">
        <Button color="primary">
          <FolderlanSvg className="w-4" />
          {t("global.appName")}
        </Button>
      </Link>
    </div>
  )
}

export default NotFoundPage
