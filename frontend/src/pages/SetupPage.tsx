// SetupPage - Component that handles initial database creation, owner registration, and login.
// The SetupPage, where the user can set up the application

import React, { useEffect, useState, useRef, useCallback } from "react"
import { FaRegUser, FaUserCircle } from "react-icons/fa"
import { FaArrowRightToBracket, FaGear } from "react-icons/fa6"
import { motion, AnimatePresence } from "framer-motion"

import { setPageName } from "@utils/setPageName"
import { setThemeColor } from "@utils/setThemeColor"
import { ApiClient } from "@utils/ApiClient"
import { saveToken } from "@utils/auth"

import { Button } from "@components/Button"
import { Input } from "@components/Input"
import { useToast } from "@components/ToastProvider"
import { AnimatedBackground } from "@components/AnimatedBackground"
import { FolderlanSvg } from "@components/FolderlanSvg"

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
          const msg =
            (initDbRes && (initDbRes.message || initDbRes.error || initDbRes.error_description)) ??
            "Failed to initialize the database."
          toast({
            type: "error",
            title: "Database creation failed",
            description: msg,
            duration: 4000,
          })
          console.warn("initDb failed:", initDbRes)
          return { ok: false, message: msg }
        }

        // Show single success toast after DB is created.
        toast({
          type: "success",
          title: "Database created",
          description: "Database initialized successfully.",
          duration: 2000,
        })
      } catch (err) {
        console.error("initDb threw:", err)
        const msg = "Network error while creating the database."
        toast({
          type: "error",
          title: "Database creation error",
          description: msg,
          duration: 4000,
        })
        return { ok: false, message: msg }
      }

      // 2) Register Owner
      try {
        const registerRes = await client.ownerRegister(username, password)

        if (!registerRes || registerRes.ok === false) {
          const msg =
            (registerRes &&
              (registerRes.wrapper?.message ||
                registerRes.error ||
                registerRes.error_description)) ??
            "Registration failed."
          toast({
            type: "error",
            title: "Registration failed",
            description: msg,
            duration: 4000,
          })
          console.warn("ownerRegister failed:", registerRes)
          return { ok: false, message: msg }
        }

        // Show single success toast after owner is registered.
        toast({
          type: "success",
          title: "Owner registered",
          description: `User ${username} created successfully.`,
          duration: 2000,
        })
      } catch (err) {
        console.error("ownerRegister threw:", err)
        const msg = "Network error during registration."
        toast({
          type: "error",
          title: "Registration error",
          description: msg,
          duration: 4000,
        })
        return { ok: false, message: msg }
      }

      // 3) Login
      try {
        const loginRes = await client.login(username, password)

        if (!loginRes || loginRes.ok === false) {
          const msg =
            (loginRes &&
              (loginRes.wrapper?.message || loginRes.error || loginRes.error_description)) ??
            "Authentication failed."
          toast({
            type: "error",
            title: "Authentication failed",
            description: msg,
            duration: 4000,
          })
          console.warn("login failed:", loginRes)
          return { ok: false, message: msg }
        }

        const token = loginRes.wrapper?.token
        if (!token) {
          const msg = "No token received from server."
          toast({
            type: "error",
            title: "Login Error",
            description: msg,
            duration: 4000,
          })
          return { ok: false, message: msg }
        }

        saveToken(token)

        // Show single success toast after login success.
        toast({
          type: "success",
          title: "Signed In",
          description: "Welcome — you are now signed in.",
          duration: 2000,
        })

        return { ok: true }
      } catch (err) {
        console.error("login threw:", err)
        const msg = "Network error while signing in."
        toast({
          type: "error",
          title: "Login error",
          description: msg,
          duration: 4000,
        })
        return { ok: false, message: msg }
      }
    },
    [toast]
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
        title: "Incomplete fields",
        description: "Please fill in all fields to continue.",
        duration: 2500,
      })
      return
    }

    if (password !== confirmPassword) {
      toast({
        type: "error",
        title: "Passwords do not match",
        description: "Make sure both passwords match to register.",
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
            title: "Registration incomplete",
            description: res.message,
            duration: 3500,
          })
        }

        console.warn("Register flow failed:", res.message)
      }
    } catch (err) {
      console.error("handleSubmit unexpected error:", err)
      toast({
        type: "error",
        title: "Unexpected Error",
        description: "An unexpected error occurred. Please try again later.",
        duration: 3500,
      })
    } finally {
      inFlightRef.current = false
      setDisabled(false)
    }
  }

  useEffect(() => {
    setThemeColor("#f5f6f7")
    setPageName(onForm ? "Register Owner" : "Welcome")
  }, [onForm])

  // Variants for card animations
  const cardTransition = { duration: 0.35, ease: "easeOut" }

  // For red password mismatch effect
  const onChangeConfirmPassword = () => {
    const password = passwordInputRef.current?.value ?? ""
    const confirmPassword = confirmPasswordInputRef.current?.value ?? ""

    if (password !== confirmPassword) setPasswordMatchs(false)
    else setPasswordMatchs(true)
  }

  return (
    <AnimatedBackground className="flex h-full w-full flex-col items-center justify-center text-gray-900">
      <div className="relative flex h-full w-full items-center justify-center">
        <AnimatePresence>
          {!onForm ? (
            <motion.main
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={cardTransition}
              className="absolute flex w-[90%] flex-col items-center gap-6 rounded-xl border-2 border-gray-400 bg-gray-100/60 p-10 md:w-[600px]"
              key="welcome"
            >
              <header className="flex flex-col items-start gap-6 md:items-center">
                <FolderlanSvg className="h-24" />
                <div className="flex flex-col items-center gap-2">
                  <h1 className="font-heading text-3xl font-semibold">
                    Welcome to Folderlan, feel at home!
                  </h1>
                  <p className="font-body text-gray-500 md:text-center">
                    Welcome to Folderlan! To get started, hit the green button to create your owner
                    account and begin sharing files between all your devices!
                  </p>
                </div>
              </header>

              <Button
                color="green"
                className="flex w-full flex-row items-center justify-center gap-2"
                onClick={() => setOnForm(true)}
              >
                <FaArrowRightToBracket className="text-md" />
                Start Setup
              </Button>
            </motion.main>
          ) : (
            <motion.main
              className="absolute flex w-[90%] flex-col gap-4 rounded-xl border-2 border-gray-400 bg-gray-100/60 p-8 md:w-96"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={cardTransition}
              key="form"
            >
              <header className="flex flex-col gap-2">
                <div className="flex items-center gap-4">
                  <FaUserCircle className="text-3xl" />
                  <h2 className="font-heading text-2xl">Register Owner</h2>
                </div>

                <div className="text-sm text-gray-500">Create an owner account to get started.</div>
              </header>

              <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                <Input
                  title="Username"
                  id="username"
                  placeholder="ImMau14"
                  type="text"
                  required
                  ref={userInputRef}
                  disabled={disabled}
                />

                <Input
                  title="Password"
                  id="password"
                  placeholder="••••••••"
                  type="password"
                  required
                  ref={passwordInputRef}
                  disabled={disabled}
                  onChange={onChangeConfirmPassword}
                />

                <Input
                  title="Confirm Password"
                  id="confirm-password"
                  placeholder="••••••••"
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
                    <p>Register Owner</p>
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
