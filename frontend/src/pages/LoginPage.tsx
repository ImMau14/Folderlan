// Login page component with authentication form and background layout
// Handles user login, form validation, and navigation to dashboard

import React, { useRef, useState, useCallback, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { ApiClient } from "@utils/ApiClient"
import { motion } from "framer-motion"

import { FaUserCircle, FaGithub, FaLock, FaUnlock } from "react-icons/fa"
import { FolderlanSvg } from "@components/FolderlanSvg"
import { FaGear } from "react-icons/fa6"
import { Button } from "@components/Button"
import { Input } from "@components/Input"

import { saveToken } from "@utils/auth"
import { setThemeColor } from "@utils/setThemeColor"
import { setPageName } from "@utils/setPageName"

import { useToast } from "@components/ToastProvider"
import { AnimatedBackground } from "@components/AnimatedBackground"
import { useI18n } from "@i18n/I18nProvider"

import { API_PATH } from "@/constants"

// Result type for login operation
interface LoginSuccess {
  ok: true
  token: string
}

interface LoginFailure {
  ok: false
  message?: string
}

type LoginResult = LoginSuccess | LoginFailure

export const LoginPage: React.FC = () => {
  const { t } = useI18n()

  // Set theme color on component mount
  useEffect(() => {
    setThemeColor("#ffffff")
    setPageName(t("login.formTitle"))
  }, [t])

  const navigate = useNavigate()
  const { toast } = useToast()

  // Form element references
  const userInputRef = useRef<HTMLInputElement | null>(null)
  const passwordInputRef = useRef<HTMLInputElement | null>(null)

  // Authentication state management
  const inFlightRef = useRef<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false)

  // Authentication API call handler
  const loginRequest = useCallback(
    async (username: string, password: string): Promise<LoginResult> => {
      try {
        const client = new ApiClient({ baseURL: API_PATH, timeoutMs: 30000 })
        const loginRes = await client.login(username, password)

        // Handle successful login with token
        const token = loginRes?.wrapper?.token
        if (loginRes.ok && token) {
          saveToken(token)
          return { ok: true, token }
        }

        // Extract error message from various response fields
        const wrapperMessage =
          typeof loginRes?.wrapper?.message === "string" ? loginRes.wrapper.message : undefined
        const errorMessage = typeof loginRes?.error === "string" ? loginRes.error : undefined
        const errorDescription =
          typeof (loginRes as { error_description?: unknown })?.error_description === "string"
            ? (loginRes as { error_description?: string }).error_description
            : undefined

        const serverMessage = wrapperMessage ?? errorMessage ?? errorDescription

        return {
          ok: false,
          message: serverMessage ?? t("login.toast.errorDescription", { message: t("login.toast.networkErrorDescription") }),
        }
      } catch (err) {
        console.error("loginRequest error:", err)
        const msg = t("login.toast.networkErrorDescription")
        return { ok: false, message: msg }
      }
    },
    [t]
  )

  // Form submission handler
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    // Prevent duplicate submissions
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
        description: res.message ?? t("login.toast.errorDescription", { message: t("login.toast.networkErrorDescription") }),
        duration: 1000 * 2.5,
      })

      console.warn("Login failed:", res.message ?? "invalid credentials / server error")
    } finally {
      inFlightRef.current = false
      setIsLoading(false)
    }
  }

  return (
    <div className="h-full w-full bg-white text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100 md:grid md:grid-cols-2 md:grid-rows-1">
      {/* Left sidebar with Folderlan information */}
      <aside className="hidden flex-col justify-center gap-8 border-b-2 border-white/40 bg-white/80 p-10 shadow-xl shadow-slate-900/10 backdrop-blur md:flex md:border-r-2 dark:border-white/10 dark:bg-slate-900/70 dark:shadow-slate-950/50">
        <header className="flex flex-col items-start gap-8 ">
          <FolderlanSvg className="h-30 text-slate-900 dark:text-slate-100 md:h-28" />
          <h1 className="font-heading text-3xl text-slate-900 dark:text-slate-100">
            {t("login.sidebarTitle")}
          </h1>
        </header>

        <p className="prose prose-slate lg:prose-md font-body text-slate-800 dark:text-slate-200">
          {t("login.sidebarDescription")}
        </p>

        <footer className="">
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/ImMau14/Folderlan"
              className="flex items-center gap-4 text-slate-700 transition hover:text-brand-600 dark:text-slate-200 dark:hover:text-brand-300"
            >
              <FaGithub className="text-4xl" />
              <p className="font-body text-sm">{t("login.sidebarVersion")}</p>
            </a>
          </div>
        </footer>
      </aside>

      {/* Right side with login form */}
      <AnimatedBackground className="p-8">
        <div className="relative flex w-full max-w-md flex-col gap-8 rounded-2xl border border-slate-200/80 bg-white/85 p-8 shadow-2xl shadow-slate-900/20 backdrop-blur-lg dark:border-slate-700/60 dark:bg-slate-900/75 dark:shadow-slate-950/60">
          <header className="flex items-center gap-4">
            <FaUserCircle className="text-3xl" />
            <h2 className="font-heading text-2xl">{t("login.formTitle")}</h2>
          </header>

          <form
            className="flex flex-col items-stretch justify-center gap-6"
            onSubmit={handleSubmit}
          >
            <Input
              title={t("login.usernameLabel")}
              id="username"
              placeholder={t("login.usernamePlaceholder")}
              autoComplete="username"
              required
              ref={userInputRef}
              disabled={isLoading}
            />

            <Input
              title={t("login.passwordLabel")}
              id="password"
              placeholder={t("login.passwordPlaceholder")}
              autoComplete="current-password"
              required
              ref={passwordInputRef}
              disabled={isLoading}
            />

            <Button color="green" type="submit" disabled={isLoading} aria-busy={isLoading}>
              <motion.div layout className={`flex items-center gap-2`}>
                <div>
                  {isLoading ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ type: "spring", stiffness: 900, damping: 25 }}
                    >
                      <FaGear className="text-md animate-spin" />
                    </motion.div>
                  ) : isLoggedIn ? (
                    <FaUnlock className="text-md" />
                  ) : (
                    <FaLock className="text-md" />
                  )}
                </div>
                <p>{t("login.submit")}</p>
              </motion.div>
            </Button>
          </form>

          <div className="flex items-center justify-center">
            <a
              href="/owner-recover"
              className="text-center font-body text-sm text-brand-700 transition hover:text-brand-500 dark:text-brand-200 dark:hover:text-brand-300"
            >
              {t("login.forgotOwner")}
            </a>
          </div>
        </div>
      </AnimatedBackground>
    </div>
  )
}
