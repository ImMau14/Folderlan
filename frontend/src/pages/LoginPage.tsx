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

import { saveToken } from "@utils/auth"
import { setThemeColor } from "@utils/setThemeColor"
import { setPageName } from "@utils/setPageName"

import { useToast } from "@components/ToastProvider"
import { AuroraBackground } from "@components/AuroraBackground"

import { API_PATH } from "@/constants"

// Result type for login operation
type LoginResult = { ok: true }

export const LoginPage: React.FC = () => {
  // Set theme color on component mount
  useEffect(() => {
    setThemeColor("#ffffff")
    setPageName("Login")
  }, [])

  const navigate = useNavigate()
  const { toast } = useToast()

  // Form element references
  const signInButtonRef = useRef<HTMLButtonElement | null>(null)
  const userInputRef = useRef<HTMLInputElement | null>(null)
  const passwordInputRef = useRef<HTMLInputElement | null>(null)

  // Authentication state management
  const inFlightRef = useRef<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false)

  // CSS classes for form styling
  const labelClasses = "flex flex-col items-start gap-2 w-full"
  const inputClasses = [
    "block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 placeholder-gray-400",
    "text-sm text-gray-900 font-body leading-5 shadow-sm",
    "focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent",
    "transition-colors duration-150",
  ].join(" ")

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
          return { ok: true }
        }

        // Extract error message from various response fields
        const serverMessage =
          (loginRes &&
            (loginRes.wrapper.message ||
              (loginRes.error as string) ||
              loginRes.error_description)) ??
          undefined

        return { ok: false, message: serverMessage ?? "Invalid username or password." }
      } catch (err) {
        console.error("loginRequest error:", err)
        const msg = "Network error. Please try again later."
        return { ok: false, message: msg }
      }
    },
    []
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
          title: "Login successful",
          description: `Welcome ${username}.`,
          duration: 2500,
        })
        navigate("/dashboard")
        return
      } else {
        toast({
          type: "error",
          title: "Login failed",
          description:
            res.message ?? "Invalid username or password. Please check your details and try again.",
          duration: 1000 * 2.5,
        })

        console.warn("Login failed:", res.message ?? "invalid credentials / server error")
      }
    } finally {
      inFlightRef.current = false
      setIsLoading(false)
    }
  }

  return (
    <div className="h-full w-full md:grid md:grid-cols-2 md:grid-rows-1">
      {/* Left sidebar with Folderlan information */}
      <aside className="hidden flex-col justify-center gap-8 border-b-2 border-gray-400 bg-gray-100 bg-gray-100/80 p-10 md:flex md:border-r-2">
        <header className="flex flex-col items-start gap-8 ">
          <FolderlanSvg className="h-30 text-gray-900 md:h-28" />
          <h1 className="font-heading text-3xl font-bold text-gray-900">Welcome to Folderlan!</h1>
        </header>

        <p className="lg:prose-md prose font-body text-gray-900">
          Share files privately, quickly, and easily with <strong>Folderlan</strong>: A native app
          powered by the speed of <strong>Rust</strong>, the concurrency of{" "}
          <strong>Actix-web</strong>, and a beautiful, intuitive interface made with{" "}
          <strong>React</strong>.
        </p>

        <footer className="">
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/ImMau14/Folderlan"
              className="flex items-center gap-4 duration-100 hover:text-gray-600 active:text-gray-500"
            >
              <FaGithub className="text-4xl text-gray-900" />
              <p className="font-body text-sm text-gray-900">ImMau14 - Folderlan 0.0.1</p>
            </a>
          </div>
        </footer>
      </aside>

      {/* Right side with login form */}
      <AuroraBackground className="flex h-[100dvh] w-full flex-col items-center justify-center gap-8 p-8">
        <div className="relative flex w-full max-w-md flex-col gap-8 rounded-xl border-2 border-gray-400 bg-gray-100 p-8  shadow-gray-900/10">
          <header className="flex items-center gap-4">
            <FaUserCircle className="text-3xl text-gray-900" />
            <h2 className="font-heading text-2xl font-bold text-gray-900">Log In</h2>
          </header>

          <form
            className="flex flex-col items-stretch justify-center gap-6"
            onSubmit={handleSubmit}
          >
            <label htmlFor="username" className={labelClasses}>
              <span className="font-body text-sm font-medium text-gray-900">Username</span>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                className={inputClasses}
                placeholder="jhon.cena"
                ref={userInputRef}
                required
                disabled={isLoading}
              />
            </label>

            <label htmlFor="password" className={labelClasses}>
              <span className="font-body text-sm font-medium text-gray-900">Password</span>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                className={inputClasses}
                placeholder="••••••••"
                ref={passwordInputRef}
                required
                disabled={isLoading}
              />
            </label>

            <Button
              color="green"
              type="submit"
              ref={signInButtonRef}
              disabled={isLoading}
              aria-busy={isLoading}
            >
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
                <p>Sign In</p>
              </motion.div>
            </Button>
          </form>

          <div className="flex items-center justify-center">
            <a
              href="/owner-recover"
              className="text-center font-body text-sm text-cyan-900 duration-100 hover:text-cyan-600 active:text-cyan-500"
            >
              Are you the owner and forgot your password?
            </a>
          </div>
        </div>
      </AuroraBackground>
    </div>
  )
}
