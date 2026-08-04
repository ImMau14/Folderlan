import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ComponentType,
  type ReactElement,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"

import { motion, AnimatePresence } from "framer-motion"

import { useTheme } from "@theme/context/ThemeContext"
import { useLowDetail } from "@shared/hooks/useLowDetail"

type ModalContextType = {
  open: (element: ReactElement) => void
  openComponent: <P extends object>(Comp: ComponentType<P>, props: P) => void
  openWide: (element: ReactElement) => void
  openWideComponent: <P extends object>(Comp: ComponentType<P>, props: P) => void
  close: () => void
  isOpen: boolean
}

const ModalContext = createContext<ModalContextType | undefined>(undefined)

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ReactElement | null>(null)
  const [wide, setWide] = useState(false)
  const { lowDetail } = useLowDetail()
  const { theme } = useTheme()

  const open = useCallback((element: ReactElement) => {
    setWide(false)
    setModal(element)
  }, [])

  const openComponent = useCallback(<P extends object>(Comp: ComponentType<P>, props: P) => {
    setWide(false)
    setModal(<Comp {...props} />)
  }, [])

  const openWide = useCallback((element: ReactElement) => {
    setWide(true)
    setModal(element)
  }, [])

  const openWideComponent = useCallback(<P extends object>(Comp: ComponentType<P>, props: P) => {
    setWide(true)
    setModal(<Comp {...props} />)
  }, [])

  const close = useCallback(() => {
    setModal(null)
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [close])

  return (
    <ModalContext.Provider
      value={{ open, openComponent, openWide, openWideComponent, close, isOpen: modal !== null }}
    >
      {children}
      <AnimatePresence initial={false} mode="wait">
        {modal && (
          <ModalRoot key="modal" onClose={close} wide={wide} lowDetail={lowDetail} theme={theme}>
            {modal}
          </ModalRoot>
        )}
      </AnimatePresence>
    </ModalContext.Provider>
  )
}

export function useModal(): ModalContextType {
  const context = useContext(ModalContext)
  if (!context) {
    throw new Error("useModal must be used within a ModalProvider")
  }
  return context
}

function ModalRoot({
  children,
  onClose,
  wide,
  lowDetail,
  theme,
}: {
  children: ReactNode
  onClose: () => void
  wide: boolean
  lowDetail: boolean
  theme: string
}) {
  const widthClasses = wide ? "max-w-md sm:max-w-lg md:max-w-3xl" : "max-w-md sm:max-w-lg"
  const themeClass = theme === "dark" ? "dark" : ""

  return createPortal(
    <div className={themeClass} data-modal="">
      <motion.div
        className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 ${lowDetail ? "" : "backdrop-blur-sm"}`}
        onMouseDown={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15, ease: "linear" }}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          className={`relative max-h-[90vh] w-full ${widthClasses} overflow-auto rounded-3xl border border-ui-border bg-ui-base p-6 shadow-ui scrollbar scrollbar-rounded scrollbar-thin scrollbar-thumb-ui-text-muted sm:p-8`}
          onMouseDown={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        >
          {children}
        </motion.div>
      </motion.div>
    </div>,
    document.body
  )
}
