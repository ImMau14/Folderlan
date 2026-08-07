/**
 * Owner recover page component.
 * Lets the owner reset their password through the local-only backend endpoint.
 * Uses the centered SetupPage layout and SetupForm validation UX.
 */

import { useRef, useState, useCallback, useEffect, type FC, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"

import { FaArrowLeft, FaKey } from "react-icons/fa"
import { FaGear } from "react-icons/fa6"

import { Button } from "@shared/components/Button"
import { LabeledInput } from "@shared/components/LabeledInput"
import GlobalControlsOverlay from "@shared/components/GlobalControlsOverlay"
import { AnimatedBackground } from "@shared/components/AnimatedBackground"

import { setPageName } from "@shared/utils/setPageName"
import ApiClient from "@shared/utils/ApiClient"

import { useToast } from "@toast/context/ToastContext"
import { useI18n } from "@i18n/context/I18nContext"

export const OwnerRecoverPage: FC = () => {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { toast } = useToast()

  useEffect(() => {
    setPageName(t("ownerRecover.title"))
  }, [t])

  const passwordInputRef = useRef<HTMLInputElement | null>(null)
  const confirmPasswordInputRef = useRef<HTMLInputElement | null>(null)

  const inFlightRef = useRef<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [password, setPassword] = useState<string>("")
  const [confirmPassword, setConfirmPassword] = useState<string>("")
  const [passwordMatchs, setPasswordMatchs] = useState<boolean>(true)

  const onChangePassword = (value: string) => {
    setPassword(value)
    setPasswordMatchs(value === confirmPassword)
  }

  const onChangeConfirmPassword = (value: string) => {
    setConfirmPassword(value)
    setPasswordMatchs(password === value)
  }

  const resetRequest = useCallback(
    async (newPassword: string): Promise<{ ok: boolean; message?: string }> => {
      try {
        const client = new ApiClient()
        const res = await client.ownerResetPassword(newPassword)
        if (!res.success) {
          const errorMessage =
            typeof res?.error?.message === "string" ? res.error.message : undefined
          return { ok: false, message: errorMessage }
        }
        return { ok: true }
      } catch (err) {
        console.error("ownerResetPassword error:", err)
        return { ok: false, message: t("ownerRecover.toast.networkErrorDescription") }
      }
    },
    [t]
  )

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (inFlightRef.current) {
      console.debug("submit ignored: request in flight")
      return
    }

    if (!password || !confirmPassword) {
      toast({
        type: "error",
        title: t("ownerRecover.toast.missingFieldsTitle"),
        description: t("ownerRecover.toast.missingFieldsDescription"),
        duration: 2500,
      })
      return
    }

    if (password !== confirmPassword) {
      setPasswordMatchs(false)
      toast({
        type: "error",
        title: t("ownerRecover.toast.mismatchTitle"),
        description: t("ownerRecover.toast.mismatchDescription"),
        duration: 2500,
      })
      return
    }

    inFlightRef.current = true
    setIsLoading(true)

    try {
      const res = await resetRequest(password)

      if (res.ok) {
        toast({
          type: "success",
          title: t("ownerRecover.toast.successTitle"),
          description: t("ownerRecover.toast.successDescription"),
          duration: 2500,
        })
        setTimeout(() => navigate("/login", { replace: true }), 1500)
        return
      }

      setPassword("")
      setConfirmPassword("")
      setPasswordMatchs(true)
      if (passwordInputRef.current) passwordInputRef.current.focus()

      toast({
        type: "error",
        title: t("ownerRecover.toast.errorTitle"),
        description:
          res.message ??
          t("ownerRecover.toast.errorDescription", {
            message: t("ownerRecover.toast.networkErrorDescription"),
          }),
        duration: 4000,
      })
      console.warn("Owner password reset failed:", res.message)
    } catch (err) {
      console.error("Owner password reset post-processing error:", err)
      toast({
        type: "error",
        title: t("ownerRecover.toast.errorTitle"),
        description: t("ownerRecover.toast.errorDescription", {
          message: t("ownerRecover.toast.networkErrorDescription"),
        }),
        duration: 4000,
      })
    } finally {
      inFlightRef.current = false
      setIsLoading(false)
    }
  }

  return (
    <AnimatedBackground className="flex h-dvh w-full flex-col items-center justify-center">
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex w-[90%] animate-fade-in-up flex-col gap-6 rounded-3xl border border-ui-border bg-ui-base p-10 shadow-ui md:w-auto">
          <header className="flex flex-col gap-2">
            <div className="flex items-center gap-4 md:w-96">
              <FaKey className="text-3xl text-ui-text opacity-90" />
              <h2 className="font-heading text-2xl font-bold text-ui-text">
                {t("ownerRecover.title")}
              </h2>
            </div>

            <div className="flex flex-col gap-2 font-body text-ui-text-muted md:w-96">
              <p className="text-sm">{t("ownerRecover.subtitle")}</p>
              <p className="text-xs">{t("ownerRecover.localOnly")}</p>
            </div>
          </header>

          <form className="flex flex-col gap-4 md:w-96" onSubmit={handleSubmit}>
            <LabeledInput
              title={t("ownerRecover.newPasswordLabel")}
              id="new-password"
              placeholder={t("ownerRecover.newPasswordPlaceholder")}
              autoComplete="new-password"
              required
              type="password"
              ref={passwordInputRef}
              value={password}
              onChange={(e) => onChangePassword(e.target.value)}
              disabled={isLoading}
              autoFocus
            />

            <LabeledInput
              title={t("ownerRecover.confirmPasswordLabel")}
              id="confirm-password"
              placeholder={t("ownerRecover.confirmPasswordPlaceholder")}
              autoComplete="new-password"
              required
              type="password"
              ref={confirmPasswordInputRef}
              value={confirmPassword}
              onChange={(e) => onChangeConfirmPassword(e.target.value)}
              disabled={isLoading}
              className={
                !passwordMatchs ? "border-red-400 hover:border-red-500 focus:ring-red-500" : ""
              }
            />

            <Button
              color="primary"
              type="submit"
              disabled={isLoading}
              aria-busy={isLoading}
              className="mt-4"
            >
              <motion.div layout className="flex items-center gap-2">
                <div>
                  {isLoading ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ type: "spring", stiffness: 900, damping: 25 }}
                    >
                      <FaGear className="animate-spin" />
                    </motion.div>
                  ) : (
                    <FaKey />
                  )}
                </div>
                <p>{t("ownerRecover.submit")}</p>
              </motion.div>
            </Button>
          </form>

          <Link
            to="/login"
            className="flex items-center justify-center gap-2 text-center font-body text-sm text-ui-primary transition hover:text-ui-primary-hover active:text-ui-primary-active"
          >
            <FaArrowLeft />
            {t("ownerRecover.backToLogin")}
          </Link>
        </div>
      </div>

      <GlobalControlsOverlay />
    </AnimatedBackground>
  )
}

export default OwnerRecoverPage
