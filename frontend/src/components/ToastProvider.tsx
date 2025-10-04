// Toast notification system providing contextual feedback for user actions
// Uses Framer Motion for animations and React Context for state management

import React, { createContext, useContext, useState, useCallback } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { MdError } from "react-icons/md"
import { FaCheckCircle, FaInfoCircle } from "react-icons/fa"
import { IoIosWarning } from "react-icons/io"
import { IoClose } from "react-icons/io5"
import clsx from "clsx"

// Toast type definitions
type ToastType = "success" | "error" | "info" | "warning"
type ToastItem = {
  id: string
  type: ToastType
  title?: string
  description?: string
  duration?: number // Display duration in milliseconds
}

// Context API interface for toast operations
type ToastContextApi = {
  toast: (t: Omit<ToastItem, "id">) => string
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextApi | undefined>(undefined)

// Hook to access toast functions from any component
export const useToast = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within ToastProvider")
  return ctx
}

// Icon and color mappings for different toast types
const ICONS: Record<ToastType, React.ElementType> = {
  error: MdError as unknown as React.ElementType,
  success: FaCheckCircle,
  info: FaInfoCircle,
  warning: IoIosWarning,
}

const COLORS: Record<ToastType, string> = {
  error: "bg-red-50 border-red-200 text-red-800",
  success: "bg-green-50 border-green-200 text-green-800",
  info: "bg-gray-50 border-gray-200 text-gray-900",
  warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
}

// Main provider component that manages toast state and rendering
export const ToastProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  // Create new toast with auto-dismiss functionality
  const toast = useCallback((t: Omit<ToastItem, "id">) => {
    const id = crypto?.randomUUID?.() ?? String(Date.now())
    const item: ToastItem = { id, ...t, duration: t.duration ?? 4000 }
    setToasts((s) => [item, ...s]) // Newest toasts appear on top

    // Auto-dismiss after specified duration
    if (item.duration && item.duration > 0) {
      setTimeout(() => {
        setToasts((s) => s.filter((toast) => toast.id !== id))
      }, item.duration)
    }
    return id
  }, [])

  // Manually dismiss specific toast
  const dismiss = useCallback((id: string) => {
    setToasts((s) => s.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      {/* Toast container with ARIA live region for accessibility */}
      <div
        aria-live="polite"
        role="status"
        className="pointer-events-none fixed right-4 top-4 z-50 flex w-[90%] max-w-full flex-col gap-3 md:w-[360px]"
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

// Animation variants for toast entrance and exit
const toastVariants = {
  hidden: { opacity: 0, y: -12, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.22 } },
  exit: { opacity: 0, y: -12, scale: 0.98, transition: { duration: 0.18 } },
}

// Individual toast card component with close button
const ToastCard: React.FC<{ toast: ToastItem; onClose: () => void }> = ({ toast, onClose }) => {
  const Icon = ICONS[toast.type]
  const color = COLORS[toast.type]

  return (
    <motion.div
      layout
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={toastVariants}
      className={clsx(
        "pointer-events-auto w-full rounded-md border p-3 shadow-lg",
        "relative flex items-start gap-3",
        color
      )}
      role="region"
      aria-label={toast.title ?? toast.type}
    >
      {/* Toast icon */}
      <div className="self-center">
        <Icon className="h-6 w-6 shrink-0" aria-hidden="true" />
      </div>

      {/* Toast content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {toast.title && <div className="font-semibold leading-5">{toast.title}</div>}
        {toast.description && <div className="mt-1 text-sm leading-5">{toast.description}</div>}
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        aria-label="Close notification"
        className="absolute right-2 top-2 rounded p-1 text-current opacity-70 hover:opacity-100"
      >
        <IoClose />
      </button>
    </motion.div>
  )
}
