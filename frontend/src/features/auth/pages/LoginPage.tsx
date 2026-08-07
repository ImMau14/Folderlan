/**
 * Login page component with authentication form and background layout.
 * Handles user login, form validation, role retrieval, and navigation to dashboard.
 */

import { useRef, useState, useCallback, useEffect, type FC, type FormEvent } from "react"
import { useNavigate, Link } from "react-router-dom"
import { motion } from "framer-motion"

import { FaUserCircle, FaGithub, FaLock, FaUnlock } from "react-icons/fa"
import { FaGear } from "react-icons/fa6"

import { Button } from "@shared/components/Button"
import { LabeledInput } from "@shared/components/LabeledInput"
import GlobalControlsOverlay from "@shared/components/GlobalControlsOverlay"
import { FolderlanSvg } from "@shared/components/FolderlanSvg"

import { setPageName } from "@shared/utils/setPageName"
import ApiClient from "@shared/utils/ApiClient"

import { useToast } from "@toast/context/ToastContext"
import { AnimatedBackground } from "@shared/components/AnimatedBackground"
import { useI18n } from "@i18n/context/I18nContext"
import { useAuth, type User } from "@auth/context/AuthContext"

export const LoginPage: FC = () => {
  const { t } = useI18n()
  const { login } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  useEffect(() => {
    setPageName(t("login.formTitle"))
  }, [t])

  const userInputRef = useRef<HTMLInputElement | null>(null)
  const passwordInputRef = useRef<HTMLInputElement | null>(null)

  const inFlightRef = useRef<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false)

  const loginRequest = useCallback(
    async (username: string, password: string) => {
      try {
        const client = new ApiClient()
        const loginRes = await client.login(username, password)

        if (!loginRes.success) {
          const errorMessage =
            typeof loginRes?.error?.message === "string" ? loginRes.error.message : undefined
          return {
            ok: false as const,
            message:
              errorMessage ??
              t("login.toast.errorDescription", {
                message: t("login.toast.networkErrorDescription"),
              }),
          }
        }

        const token = loginRes?.data?.token
        if (token) {
          const meRes = await client.getMe()
          if (meRes.success && meRes.data.data) {
            const d = meRes.data.data
            const user: User = {
              id: d.id,
              username: d.username,
              role: d.role as User["role"],
              can_upload: d.can_upload,
              can_delete_own_files: d.can_delete_own_files,
              has_upload_limits: d.has_upload_limits,
              upload_limit: d.upload_limit,
            }
            return { ok: true as const, token, user }
          }
          return { ok: false as const, message: "Could not fetch user info" }
        }

        return { ok: false as const, message: "unknown error" }
      } catch (err) {
        console.error("loginRequest error:", err)
        return { ok: false as const, message: t("login.toast.networkErrorDescription") }
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

    const username = userInputRef.current?.value ?? ""
    const password = passwordInputRef.current?.value ?? ""

    setIsLoading(true)
    inFlightRef.current = true

    try {
      const res = await loginRequest(username, password)

      if (res.ok) {
        setIsLoggedIn(true)
        login(res.token, res.user)

        toast({
          type: "success",
          title: t("login.toast.successTitle"),
          description: t("login.toast.successDescription", { username }),
          duration: 2500,
        })
        navigate("/dashboard")
        return
      }

      toast({
        type: "error",
        title: t("login.toast.errorTitle"),
        description:
          res.message ??
          t("login.toast.errorDescription", { message: t("login.toast.networkErrorDescription") }),
        duration: 2500,
      })
      console.warn("Login failed:", res.message ?? "invalid credentials / server error")
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast({
        type: "error",
        title: t("login.toast.errorTitle"),
        description: message,
        duration: 5000,
      })
      console.error("Login post-processing error:", err)
    } finally {
      inFlightRef.current = false
      setIsLoading(false)
    }
  }

  return (
    <div className="relative h-full w-full">
      <div className="h-full w-full transition-colors md:grid md:grid-cols-2 md:grid-rows-1">
        {/* Left sidebar with Folderlan information */}
        <aside className="hidden flex-col justify-center gap-8 border-ui-border bg-ui-base p-10 shadow-xl md:flex md:border-r">
          <header className="flex flex-col items-start gap-8 text-ui-text">
            <FolderlanSvg className="md:h-28" />
            <h1 className="font-heading text-3xl font-bold">{t("login.sidebarTitle")}</h1>
          </header>

          <p className="prose prose-slate font-body text-ui-text-muted">
            {t("login.sidebarDescription")}
          </p>

          <footer className="">
            <div className="flex items-center gap-4">
              <a
                href="https://github.com/ImMau14/Folderlan"
                className="flex items-center gap-4 text-ui-text transition hover:text-ui-primary active:text-ui-primary-hover"
              >
                <FaGithub className="text-4xl" />
                <p className="font-body text-sm">
                  {t("login.sidebarVersion", { version: import.meta.env.APP_VERSION })}
                </p>
              </a>
            </div>
          </footer>
        </aside>

        {/* Right side with login form */}
        <AnimatedBackground className="p-8">
          <div className="relative flex w-full max-w-md flex-col gap-8 rounded-3xl border border-ui-border bg-ui-base p-10 shadow-ui">
            <header className="flex items-center gap-4 text-slate-900 dark:text-slate-100">
              <FaUserCircle className="text-3xl opacity-90" />
              <h2 className="font-heading text-2xl font-bold">{t("login.formTitle")}</h2>
            </header>

            <form
              className="flex flex-col items-stretch justify-center gap-6"
              onSubmit={handleSubmit}
            >
              <LabeledInput
                title={t("login.usernameLabel")}
                id="username"
                placeholder={t("login.usernamePlaceholder")}
                autoComplete="username"
                required
                ref={userInputRef}
                disabled={isLoading}
              />

              <LabeledInput
                title={t("login.passwordLabel")}
                id="password"
                placeholder={t("login.passwordPlaceholder")}
                autoComplete="current-password"
                required
                ref={passwordInputRef}
                disabled={isLoading}
                type="password"
              />

              <Button color="primary" type="submit" disabled={isLoading} aria-busy={isLoading}>
                <motion.div layout className={`flex items-center gap-2`}>
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
                    ) : isLoggedIn ? (
                      <FaUnlock />
                    ) : (
                      <FaLock />
                    )}
                  </div>
                  <p>{t("login.submit")}</p>
                </motion.div>
              </Button>
            </form>

            <div className="flex items-center justify-center">
              <Link
                to="/owner-recover"
                className="text-center font-body text-sm text-ui-primary transition hover:text-ui-primary-hover active:text-ui-primary-active"
              >
                {t("login.forgotOwner")}
              </Link>
            </div>
          </div>
        </AnimatedBackground>
      </div>

      <GlobalControlsOverlay />
    </div>
  )
}

export default LoginPage
