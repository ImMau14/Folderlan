/**
 * SetupForm - Presentational form with internal validation and UX logic.
 * Handles client-side validation, input state, and submission flow.
 * Entrance animation: CSS class "animate-fade-in-up" + "opacity-0".
 * Exit animation: Framer Motion slides up slightly while fading out on the wrapper.
 */

import { useRef, useState, type FC, type FormEvent, type ChangeEvent } from "react"
import { FaRegUser, FaUserCircle } from "react-icons/fa"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"

import { FaGear } from "react-icons/fa6"

import { LabeledInput } from "@shared/components/LabeledInput"
import { Button } from "@shared/components/Button"

import { useI18n } from "@i18n/context/I18nContext"
import { useToast } from "@toast/context/ToastContext"
import { useDatabase } from "@database/context/DatabaseContext"

type Props = {
  onRegister: (username: string, password: string) => Promise<{ ok: boolean; message?: string }>
}

const SetupForm: FC<Props> = ({ onRegister }) => {
  // I18n dict object
  const { t } = useI18n()

  // Toast notification hook
  const { toast } = useToast()

  // Local input state (form is responsible for validation & UX).
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordMatchs, setPasswordMatchs] = useState(true)
  const [disabled, setDisabled] = useState(false)

  // Database hook to refresh guard
  const { setDbExists, refresh } = useDatabase()

  // Navigator hook to go to dashboard
  const navigate = useNavigate()

  // In-flight guard to prevent duplicate submissions without re-render churn.
  const inFlightRef = useRef(false)

  // Refs for focusing inputs after errors
  const passwordInputRef = useRef<HTMLInputElement | null>(null)
  const confirmPasswordInputRef = useRef<HTMLInputElement | null>(null)

  // Validate live password match
  const onChangePassword = (value: string) => {
    setPassword(value)
    setPasswordMatchs(value === confirmPassword)
  }

  const onChangeConfirmPassword = (value: string) => {
    setConfirmPassword(value)
    setPasswordMatchs(password === value)
  }

  // Handle submit: client-side validation then delegate to onRegister.
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    // Guard duplicate submits
    if (inFlightRef.current) {
      console.debug("submit ignored: request in flight (form)")
      return
    }

    // Basic client validation (form responsibility)
    if (!username.trim() || !password || !confirmPassword) {
      toast({
        type: "error",
        title: t("setup.toast.missingFieldsTitle"),
        description: t("setup.toast.missingFieldsDescription"),
        duration: 2500,
      })
      return
    }

    if (password !== confirmPassword) {
      setPasswordMatchs(false)
      toast({
        type: "error",
        title: t("setup.toast.passwordMismatchTitle"),
        description: t("setup.toast.passwordMismatchDescription"),
        duration: 2500,
      })
      return
    }

    // Begin submission UX
    inFlightRef.current = true
    setDisabled(true)

    try {
      const res = await onRegister(username, password)

      if (res.ok) {
        // Wait a short bit to allow the final toast to be visible, then do a full page load to dashboard.
        setDbExists(true)
        refresh().catch((e) => console.error("refresh after setup", e))
        navigate("/dashboard", { replace: true })
        return
      } else {
        // Clear password inputs and focus password for retry.
        setPassword("")
        setConfirmPassword("")
        setPasswordMatchs(true)
        if (passwordInputRef.current) passwordInputRef.current.focus()

        // If server returned a message, show fallback toast (page-level toasts also run in registerOwnerRequest).
        if (res.message) {
          toast({
            type: "error",
            title: t("setup.toast.registrationIncompleteTitle"),
            description: t("setup.toast.registrationIncompleteDescription", {
              message: res.message,
            }),
            duration: 3500,
          })
        }

        console.warn("Register flow failed:", res.message)
      }
    } catch (err) {
      console.error("handleSubmit unexpected error (form):", err)
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

  return (
    <motion.div
      // The motion wrapper ONLY handles exit. No initial/animate, so it renders with opacity: 1 by default,
      // allowing the inner div's CSS animation to run unhindered.
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="flex w-full items-center justify-center"
    >
      {/* Inner container handles entrance via CSS.
          animate-fade-in-up: defined in tailwind.config.js, runs fade-in-up 0.5s ease forwards.
          opacity-0: sets base opacity to 0, overridden by the animation. */}
      <div className="flex w-[90%] animate-fade-in-up flex-col gap-6 rounded-3xl border border-ui-border bg-ui-base p-10 shadow-ui md:w-auto">
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <FaUserCircle className="text-3xl text-ui-text opacity-90" />
            <h2 className="font-heading text-2xl font-bold text-ui-text">{t("setup.formTitle")}</h2>
          </div>

          <div className="font-body text-sm text-ui-text-muted">{t("setup.formSubtitle")}</div>
        </header>

        <form className="flex flex-col gap-4 md:w-96" onSubmit={handleSubmit}>
          <LabeledInput
            title={t("setup.usernameLabel")}
            id="username"
            placeholder={t("setup.usernamePlaceholder")}
            type="text"
            required
            value={username}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
            disabled={disabled}
            autoComplete="off"
            spellCheck="false"
            autoCorrect="off"
            autoCapitalize="off"
            autoFocus
          />

          <LabeledInput
            title={t("setup.passwordLabel")}
            id="password"
            placeholder={t("setup.passwordPlaceholder")}
            type="password"
            required
            ref={passwordInputRef}
            value={password}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onChangePassword(e.target.value)}
            disabled={disabled}
          />

          <LabeledInput
            title={t("setup.confirmPasswordLabel")}
            id="confirm-password"
            placeholder={t("setup.confirmPasswordPlaceholder")}
            type="password"
            required
            ref={confirmPasswordInputRef}
            value={confirmPassword}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onChangeConfirmPassword(e.target.value)}
            disabled={disabled}
            className={
              !passwordMatchs ? "border-red-400 hover:border-red-500 focus:ring-red-500" : ""
            }
          />

          <Button type="submit" disabled={disabled} className="mt-4">
            <motion.div layout className="flex items-center gap-2">
              <div>
                {disabled ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: "spring", stiffness: 900, damping: 25 }}
                  >
                    <FaGear className="animate-spin" />
                  </motion.div>
                ) : (
                  <FaRegUser />
                )}
              </div>
              <p>{t("setup.registerButton")}</p>
            </motion.div>
          </Button>
        </form>
      </div>
    </motion.div>
  )
}

export default SetupForm
