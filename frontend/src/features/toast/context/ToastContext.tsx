// Toast notification system with hover-pause, configurable toggle, and summary support.

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  type ReactNode,
} from "react"
import { AnimatePresence, motion } from "framer-motion"
import { MdError } from "react-icons/md"
import { FaCheckCircle, FaInfoCircle } from "react-icons/fa"
import { IoIosWarning } from "react-icons/io"
import { IoClose } from "react-icons/io5"
import clsx from "clsx"

import { useTheme } from "@theme/context/ThemeContext"

type ToastType = "success" | "error" | "info" | "warning"

type ToastItem = {
  id: string
  type: ToastType
  title?: string
  description?: string
  duration?: number
}

type ToastContextApi = {
  toast: (t: Omit<ToastItem, "id">) => string
  dismiss: (id: string) => void
  enabled: boolean
  setEnabled: (v: boolean) => void
}

const ToastContext = createContext<ToastContextApi | undefined>(undefined)

const STORAGE_KEY = "folderlan:toastEnabled"

const getInitialEnabled = (): boolean => {
  if (typeof window === "undefined") return true
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored !== "false"
  } catch {
    return true
  }
}

export const useToast = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within ToastProvider")
  return ctx
}

const ICONS: Record<ToastType, React.ElementType> = {
  error: MdError,
  success: FaCheckCircle,
  info: FaInfoCircle,
  warning: IoIosWarning,
}

const COLORS: Record<ToastType, string> = {
  error: "bg-ui-danger",
  success: "bg-ui-success",
  info: "bg-ui-info",
  warning: "bg-ui-warning",
}

export const ToastProvider: React.FC<{ children?: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [enabled, setEnabledState] = useState<boolean>(getInitialEnabled)
  const { theme } = useTheme()

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(enabled))
    } catch {
      // silent
    }
  }, [enabled])

  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v)
  }, [])

  const toast = useCallback(
    (t: Omit<ToastItem, "id">) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
      const item: ToastItem = { id, ...t, duration: t.duration ?? 4000 }

      if (!enabled) return id

      setToasts((s) => [item, ...s])

      if (item.duration && item.duration > 0) {
        setTimeout(() => {
          setToasts((s) => s.filter((toast) => toast.id !== id))
        }, item.duration)
      }
      return id
    },
    [enabled]
  )

  const dismiss = useCallback((id: string) => {
    setToasts((s) => s.filter((t) => t.id !== id))
  }, [])

  const themeClass = useMemo(() => (theme === "dark" ? "dark" : ""), [theme])

  return (
    <ToastContext.Provider value={{ toast, dismiss, enabled, setEnabled }}>
      {children}
      <div
        aria-live="polite"
        role="status"
        className={clsx(
          "pointer-events-none fixed bottom-4 right-0 z-[100] flex w-full max-w-full flex-col-reverse gap-3 px-4 md:w-[26rem]",
          themeClass
        )}
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <ToastCard key={t.id} toast={t} onClose={() => dismiss(t.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

const toastVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.22 } },
  exit: { opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.18 } },
}

const ToastCard: React.FC<{ toast: ToastItem; onClose: () => void }> = ({ toast, onClose }) => {
  const Icon = ICONS[toast.type]
  const color = COLORS[toast.type]
  const { theme } = useTheme()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pauseTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const resumeTimer = useCallback(() => {
    if (toast.duration && toast.duration > 0) {
      timerRef.current = setTimeout(() => {
        onClose()
      }, toast.duration)
    }
  }, [toast.duration, onClose])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <motion.div
      layout
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={toastVariants}
      onMouseEnter={pauseTimer}
      onMouseLeave={resumeTimer}
      className={clsx(
        "pointer-events-auto relative w-full rounded-3xl p-4",
        "flex items-start gap-3",
        color,
        theme === "dark" ? "text-gray-900" : "text-white"
      )}
      role="region"
      aria-label={toast.title ?? toast.type}
    >
      <div className="self-center">
        <Icon className="h-6 w-6 shrink-0" aria-hidden="true" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {toast.title && <div className="font-heading font-semibold leading-5">{toast.title}</div>}
        {toast.description && (
          <div className="mt-1 font-body text-sm leading-5 opacity-85">{toast.description}</div>
        )}
      </div>

      <button
        onClick={onClose}
        aria-label="Cerrar notificación"
        className="absolute right-2 top-2 rounded p-1 text-current opacity-70 hover:opacity-100"
      >
        <IoClose />
      </button>
    </motion.div>
  )
}
