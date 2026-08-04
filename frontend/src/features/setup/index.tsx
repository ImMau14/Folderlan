/**
 * SetupPage - Component that handles initial database creation, owner registration, and login.
 * After successful setup, the owner is logged in as admin.
 */

import { useEffect, useState, useCallback, type FC } from "react"
import { AnimatePresence } from "framer-motion"

import { setPageName } from "@shared/utils/setPageName"
import ApiClient from "@shared/utils/ApiClient"

import AnimatedBackground from "@shared/components/AnimatedBackground"
import GlobalControlsOverlay from "@shared/components/GlobalControlsOverlay"

import { useI18n } from "@i18n/context/I18nContext"
import { useToast } from "@toast/context/ToastContext"
import { useAuth } from "@auth/context/AuthContext"

import SetupWelcome from "./components/SetupWelcome"
import SetupForm from "./components/SetupForm"

type OperationResult = { ok: boolean; message?: string }

export const SetupPage: FC = () => {
  const [onForm, setOnForm] = useState(false)
  const { login } = useAuth()
  const { toast } = useToast()
  const { t } = useI18n()

  // Orchestrates the 3-step registration flow: DB init → owner creation → login.
  const registerOwnerRequest = useCallback(
    async (username: string, password: string): Promise<OperationResult> => {
      const client = new ApiClient()

      // 1) Initialize Database
      try {
        const initDbRes = await client.initDb()
        if (!initDbRes || !initDbRes.success) {
          const rawMessage = initDbRes?.error?.message ?? undefined
          const msg = rawMessage ?? t("setup.toast.unexpectedErrorDescription")
          toast({
            type: "error",
            title: t("setup.toast.databaseCreateErrorTitle"),
            description: t("setup.toast.databaseCreateErrorDescription", { message: msg }),
            duration: 4000,
          })
          return { ok: false, message: msg }
        }
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
        if (!registerRes || !registerRes.success) {
          const msg = registerRes?.error?.message ?? t("setup.toast.unexpectedErrorDescription")
          toast({
            type: "error",
            title: t("setup.toast.registrationFailedTitle"),
            description: t("setup.toast.registrationFailedDescription", { message: msg }),
            duration: 4000,
          })
          return { ok: false, message: msg }
        }
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
        if (!loginRes || !loginRes.success) {
          const msg = loginRes?.error?.message ?? t("setup.toast.unexpectedErrorDescription")
          toast({
            type: "error",
            title: t("setup.toast.loginFailedTitle"),
            description: t("setup.toast.loginFailedDescription", { message: msg }),
            duration: 4000,
          })
          return { ok: false, message: msg }
        }

        const token = loginRes?.data?.token
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

        // Owner is always admin with full permissions
        login(token, {
          username,
          role: "owner",
          can_upload: true,
          can_delete_own_files: true,
          has_upload_limits: false,
          upload_limit: 0,
        })

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
    [t, toast, login]
  )

  const onRegister = useCallback(
    async (username: string, password: string) => {
      return await registerOwnerRequest(username, password)
    },
    [registerOwnerRequest]
  )

  // Update the page title based on the current view.
  useEffect(() => {
    setPageName(onForm ? t("setup.formTitle") : t("setup.welcomeTitle"))
  }, [onForm, t])

  return (
    <AnimatedBackground className="flex h-dvh w-full flex-col items-center justify-center">
      <div className="flex h-full w-full items-center justify-center">
        <AnimatePresence mode="wait" initial={false}>
          {!onForm ? (
            <SetupWelcome key="welcome" onStart={() => setOnForm(true)} />
          ) : (
            <SetupForm key="form" onRegister={onRegister} />
          )}
        </AnimatePresence>
        <GlobalControlsOverlay />
      </div>
    </AnimatedBackground>
  )
}

export default SetupPage
