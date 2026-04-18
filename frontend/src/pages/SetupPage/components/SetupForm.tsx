// SetupForm - Presentational form with internal validation and UX logic.
// Handles client-side validation, input state, and submission flow.

import { useRef, useState, type FC, type FormEvent, type ChangeEvent } from "react"
import { FaRegUser, FaUserCircle } from "react-icons/fa"
import { motion, type Transition } from "framer-motion"
import { useNavigate } from "react-router-dom"

import { FaGear } from "react-icons/fa6"

import { Input } from "@components/Input"
import { Button } from "@components/Button"

import { useI18n } from "@contexts/I18nContext"
import { useToast } from "@contexts/ToastContext"
import { useDatabase } from "@contexts/DatabaseContext"

type Props = {
  cardTransition: Transition
  onRegister: (username: string, password: string) => Promise<{ ok: boolean; message?: string }>
}

const SetupForm: FC<Props> = ({ cardTransition, onRegister }) => {
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
    <motion.main
      className="absolute flex w-[90%] flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white/85 p-8 shadow-2xl shadow-slate-900/20 backdrop-blur-md md:w-96 dark:border-slate-700/60 dark:bg-slate-900/75 dark:shadow-slate-900/50"
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={cardTransition}
    >
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-4">
          <FaUserCircle className="text-3xl text-gray-900 dark:text-slate-100" />
          <h2 className="font-heading text-2xl text-gray-900 dark:text-slate-50">
            {t("setup.formTitle")}
          </h2>
        </div>

        <div className="text-sm text-gray-500 dark:text-slate-300">{t("setup.formSubtitle")}</div>
      </header>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <Input
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

        <Input
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

        <Input
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
    </motion.main>
  )
}

export default SetupForm
