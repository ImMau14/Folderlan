import FloatingContainer from "../components/FloatingContainer"
import { useI18n } from "@i18n/context/I18nContext"

export default function DownloadPage() {
  const { t } = useI18n()
  return (
    <div className="p-6">
      <FloatingContainer className="animate-fall-on-1 max-w-2xl items-start">
        <h2 className="font-heading text-xl font-bold tracking-tight text-ui-text">
          {t("menu.download")}
        </h2>
        <p className="mt-2 font-body text-sm font-medium text-ui-text-muted">
          Downloads will appear here. Under construction.
        </p>
      </FloatingContainer>
    </div>
  )
}
