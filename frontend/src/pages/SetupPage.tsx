// SetupPage - Component that handles initial database creation, owner registration, and login.
// The SetupPage, where the user can set up the application

import React, { useEffect, useState, useRef, useCallback } from "react"
import { FaRegUser, FaUserCircle } from "react-icons/fa"
import { FaArrowRightToBracket, FaGear } from "react-icons/fa6"
import { motion, AnimatePresence, type Transition } from "framer-motion"

import { setPageName } from "@utils/setPageName"
import { setThemeColor } from "@utils/setThemeColor"
import { ApiClient } from "@utils/ApiClient"
import { saveToken } from "@utils/auth"

import { Button } from "@components/Button"
import { Input } from "@components/Input"
import { useToast } from "@components/ToastProvider"
import { AnimatedBackground } from "@components/AnimatedBackground"
import { FolderlanSvg } from "@components/FolderlanSvg"
import { useI18n } from "@i18n/I18nProvider"

import { API_PATH } from "@/constants"

// OperationResult describes a simple boolean result with an optional message.
type OperationResult = { ok: boolean; message?: string }

export const SetupPage = () => {
  // Local view state: whether to show the form or the welcome screen.
  const [onForm, setOnForm] = useState(false)

  // Disabled causes re-render and disables inputs/buttons while request is in flight.
  const [disabled, setDisabled] = useState(false)
  const [passwordMatchs, setPasswordMatchs] = useState(true)

  // Refs to inputs.
  const userInputRef = useRef<HTMLInputElement | null>(null)
  const passwordInputRef = useRef<HTMLInputElement | null>(null)
  const confirmPasswordInputRef = useRef<HTMLInputElement | null>(null)

  // In-flight guard to prevent duplicate submissions without triggering re-render.
  const inFlightRef = useRef<boolean>(false)

  const { toast } = useToast()
  const { t } = useI18n()

  // RegisterOwnerRequest performs three sequential operations:
  // 1) Initialize database, 2) Register owner, 3) Log in and save token.
  const registerOwnerRequest = useCallback(
    async (username: string, password: string): Promise<OperationResult> => {
      const client = new ApiClient({ baseURL: API_PATH, timeoutMs: 30000 })

      // 1) Initialize Database
      try {
        const initDbRes = await client.initDb()

        // Validate result; treat falsy or explicit ok:false as failure.
        if (!initDbRes || initDbRes.ok === false) {
          const data = initDbRes as Record<string, any> | undefined
          const rawMessage =
            data?.wrapper?.message ?? data?.message ?? data?.error ?? data?.error_description ?? undefined
          const fallbackMessage = t("setup.toast.unexpectedErrorDescription")
          const msg = rawMessage ?? fallbackMessage
          toast({
            type: "error",
            title: t("setup.toast.databaseCreateErrorTitle"),
            description: t("setup.toast.databaseCreateErrorDescription", { message: msg }),
            duration: 4000,
          })
          console.warn("initDb failed:", initDbRes)
          return { ok: false, message: msg }
        }

        // Show single success toast after DB is created.
        toast({
          type: "success",
          title: t("setup.toast.databaseCreatedTitle"),
          description: t("setup.toast.databaseCreatedDescription"),
          duration: 2000,
        })
      } catch (err) {
        console.error("initDb threw:", err)
        const msg = t("setup.toast.databaseNetworkErrorDescription")
        toast({
          type: "error",
          title: t("setup.toast.databaseNetworkErrorTitle"),
          description: msg,
          duration: 4000,
        })
        return { ok: false, message: msg }
      }

      // 2) Register Owner
      try {
        const registerRes = await client.ownerRegister(username, password)

        if (!registerRes || registerRes.ok === false) {
          const data = registerRes as Record<string, any> | undefined
          const msg =
            data?.wrapper?.message ??
            data?.message ??
            data?.error ??
            data?.error_description ??
            t("setup.toast.unexpectedErrorDescription")
          toast({
            type: "error",
            title: t("setup.toast.registrationFailedTitle"),
            description: t("setup.toast.registrationFailedDescription", { message: msg }),
            duration: 4000,
          })
          console.warn("ownerRegister failed:", registerRes)
          return { ok: false, message: msg }
        }

        // Show single success toast after owner is registered.
        toast({
          type: "success",
          title: t("setup.toast.ownerRegisteredTitle"),
          description: t("setup.toast.ownerRegisteredDescription", { username }),
          duration: 2000,
        })
      } catch (err) {
        console.error("ownerRegister threw:", err)
        const msg = t("setup.toast.registrationNetworkErrorDescription")
        toast({
          type: "error",
          title: t("setup.toast.registrationNetworkErrorTitle"),
          description: msg,
          duration: 4000,
        })
        return { ok: false, message: msg }
      }

      // 3) Login
      try {
        const loginRes = await client.login(username, password)

        if (!loginRes || loginRes.ok === false) {
          const data = loginRes as Record<string, any> | undefined
          const msg =
            data?.wrapper?.message ??
            data?.message ??
            data?.error ??
            data?.error_description ??
            t("setup.toast.unexpectedErrorDescription")
          toast({
            type: "error",
            title: t("setup.toast.loginFailedTitle"),
            description: t("setup.toast.loginFailedDescription", { message: msg }),
            duration: 4000,
          })
          console.warn("login failed:", loginRes)
          return { ok: false, message: msg }
        }

        const token = loginRes.wrapper?.token
        if (!token) {
          const msg = t("setup.toast.loginNoTokenDescription")
          toast({
            type: "error",
            title: t("setup.toast.loginNoTokenTitle"),
            description: msg,
            duration: 4000,
          })
          return { ok: false, message: msg }
        }

        saveToken(token)

        // Show single success toast after login success.
        toast({
          type: "success",
          title: t("setup.toast.loginSuccessTitle"),
          description: t("setup.toast.loginSuccessDescription"),
          duration: 2000,
        })

        return { ok: true }
      } catch (err) {
        console.error("login threw:", err)
        const msg = t("setup.toast.loginErrorDescription")
        toast({
          type: "error",
          title: t("setup.toast.loginErrorTitle"),
          description: msg,
          duration: 4000,
        })
        return { ok: false, message: msg }
      }
    },
    [t, toast]
  )

  // Handle submit, guard duplicates, basic client validation and UX touches.
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    // Prevent duplicate submissions
    if (inFlightRef.current) {
      console.debug("submit ignored: request in flight")
      return
    }

    const username = userInputRef.current?.value ?? ""
    const password = passwordInputRef.current?.value ?? ""
    const confirmPassword = confirmPasswordInputRef.current?.value ?? ""

    if (!username || !password || !confirmPassword) {
      toast({
        type: "error",
        title: t("setup.toast.missingFieldsTitle"),
        description: t("setup.toast.missingFieldsDescription"),
        duration: 2500,
      })
      return
    }

    if (password !== confirmPassword) {
      toast({
        type: "error",
        title: t("setup.toast.passwordMismatchTitle"),
        description: t("setup.toast.passwordMismatchDescription"),
        duration: 2500,
      })
      return
    }

    inFlightRef.current = true
    setDisabled(true)

    try {
      const res = await registerOwnerRequest(username, password)

      if (res.ok) {
        // Wait a short bit to allow the final toast to be visible, then do a full page load to dashboard.
        setTimeout(() => {
          // Force full reload to /dashboard so the app state is fresh.
          window.location.href = "/dashboard"
        }, 1000)
        return
      } else {
        // Clear passwords for security and better UX, then focus password.
        if (passwordInputRef.current) passwordInputRef.current.value = ""
        if (confirmPasswordInputRef.current) confirmPasswordInputRef.current.value = ""
        passwordInputRef.current?.focus()

        // Fallback error toast if registerOwnerRequest didn't already show a message.
        if (res.message) {
          toast({
            type: "error",
            title: t("setup.toast.registrationIncompleteTitle"),
            description: t("setup.toast.registrationIncompleteDescription", { message: res.message }),
            duration: 3500,
          })
        }

        console.warn("Register flow failed:", res.message)
      }
    } catch (err) {
      console.error("handleSubmit unexpected error:", err)
      toast({
        type: "error",
        title: t("setup.toast.unexpectedErrorTitle"),
        description: t("setup.toast.unexpectedErrorDescription"),
        duration: 3500,
      })
    } finally {
      inFlightRef.current = false
      setDisabled(false)
    }
  }

  useEffect(() => {
    setThemeColor("#f5f6f7")
    setPageName(onForm ? t("setup.formTitle") : t("setup.welcomeTitle"))
  }, [onForm, t])

  const cardTransition: Transition = { duration: 0.35, ease: [0.16, 1, 0.3, 1] }

  // For red password mismatch effect
  const onChangeConfirmPassword = () => {
    const password = passwordInputRef.current?.value ?? ""
    const confirmPassword = confirmPasswordInputRef.current?.value ?? ""

    if (password !== confirmPassword) setPasswordMatchs(false)
    else setPasswordMatchs(true)
  }

  return (
    <AnimatedBackground className="flex min-h-screen w-full flex-col items-center justify-center text-gray-900 dark:text-slate-100">
      <div className="relative flex h-full w-full items-center justify-center">
        <AnimatePresence>
          {!onForm ? (
            <motion.main
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={cardTransition}
              className="absolute flex w-[90%] flex-col items-center gap-6 rounded-2xl border border-slate-200/80 bg-white/80 p-10 shadow-2xl shadow-slate-900/20 backdrop-blur-md md:w-[600px] dark:border-slate-700/60 dark:bg-slate-900/70 dark:shadow-slate-900/50"
              key="welcome"
            >
              <header className="flex flex-col items-start gap-6 md:items-center">
                <FolderlanSvg className="h-24" />
                <div className="flex flex-col items-center gap-2">
                  <h1 className="font-heading text-3xl font-semibold text-gray-900 dark:text-slate-50">
                    {t("setup.welcomeTitle")}
                  </h1>
                  <p className="font-body text-center text-gray-600 dark:text-slate-300">
                    {t("setup.welcomeDescription")}
                  </p>
                </div>
              </header>

              <Button
                color="green"
                className="flex w-full flex-row items-center justify-center gap-2"
                onClick={() => setOnForm(true)}
              >
                <FaArrowRightToBracket className="text-md" />
                {t("setup.startButton")}
              </Button>
            </motion.main>
          ) : (
            <motion.main
              className="absolute flex w-[90%] flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white/85 p-8 shadow-2xl shadow-slate-900/20 backdrop-blur-md md:w-96 dark:border-slate-700/60 dark:bg-slate-900/75 dark:shadow-slate-900/50"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={cardTransition}
              key="form"
            >
              <header className="flex flex-col gap-2">
                <div className="flex items-center gap-4">
                  <FaUserCircle className="text-3xl" />
                  <h2 className="font-heading text-2xl text-gray-900 dark:text-slate-50">
                    {t("setup.formTitle")}
                  </h2>
                </div>

                <div className="text-sm text-gray-500 dark:text-slate-300">
                  {t("setup.formSubtitle")}
                </div>
              </header>

              <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                <Input
                  title={t("setup.usernameLabel")}
                  id="username"
                  placeholder={t("setup.usernamePlaceholder")}
                  type="text"
                  required
                  ref={userInputRef}
                  disabled={disabled}
                />

                <Input
                  title={t("setup.passwordLabel")}
                  id="password"
                  placeholder={t("setup.passwordPlaceholder")}
                  type="password"
                  required
                  ref={passwordInputRef}
                  disabled={disabled}
                  onChange={onChangeConfirmPassword}
                />

                <Input
                  title={t("setup.confirmPasswordLabel")}
                  id="confirm-password"
                  placeholder={t("setup.confirmPasswordPlaceholder")}
                  type="password"
                  required
                  ref={confirmPasswordInputRef}
                  disabled={disabled}
                  onChange={onChangeConfirmPassword}
                  className={
                    !passwordMatchs ? "border-red-400 hover:border-red-500 focus:ring-red-500" : ""
                  }
                />

                <Button
                  color="green"
                  className="mt-4 flex flex-row items-center justify-center gap-2"
                  type="submit"
                  disabled={disabled}
                >
                  <motion.div layout className="flex items-center gap-2">
                    <div>
                      {disabled ? (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          transition={{ type: "spring", stiffness: 900, damping: 25 }}
                        >
                          <FaGear className="text-md animate-spin" />
                        </motion.div>
                      ) : (
                        <FaRegUser className="text-md" />
                      )}
                    </div>
                    <p>{t("setup.registerButton")}</p>
                  </motion.div>
                </Button>
              </form>
            </motion.main>
          )}
        </AnimatePresence>
      </div>
    </AnimatedBackground>
  )
}
