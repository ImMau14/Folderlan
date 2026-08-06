import { Fragment } from "react"
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/react"
import { motion } from "framer-motion"
import { FaChevronDown } from "react-icons/fa6"
import clsx from "clsx"

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

const listVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.04 },
  },
}

const optionVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.15, ease: [0.2, 0, 0, 1] as const } },
}

export default function Select({
  value,
  options,
  onChange,
  placeholder = "Seleccionar...",
  className,
}: SelectProps) {
  const selectedLabel = options.find((o) => o.value === value)?.label ?? placeholder

  return (
    <Listbox value={value} onChange={onChange}>
      <div className={clsx("relative", className)}>
        <ListboxButton
          className={clsx(
            "flex h-10 w-full items-center justify-between gap-2 rounded-full border px-4 font-body text-sm transition-all focus:outline-none focus:ring-2 focus:ring-ui-primary/40",
            value
              ? "border-ui-primary bg-ui-primary/5 font-semibold text-ui-primary"
              : "border-ui-border bg-ui-front text-ui-text-muted hover:border-ui-text hover:bg-ui-border/20"
          )}
        >
          <span className="truncate">{selectedLabel}</span>
          <FaChevronDown className="h-3 w-3 shrink-0" />
        </ListboxButton>

        <ListboxOptions
          transition
          anchor="bottom start"
          className={clsx(
            "glass z-50 mt-2 min-w-[180px] overflow-hidden rounded-2xl p-2 text-sm font-medium backdrop-blur-md",
            "focus:outline-none",
            "transition duration-150 ease-[cubic-bezier(0.2,0,0,1)]",
            "data-[closed]:scale-95 data-[closed]:opacity-0",
            "data-[focus]:outline-none"
          )}
        >
          <motion.ul
            variants={listVariants}
            initial="hidden"
            animate="visible"
            className="flex max-h-60 flex-col overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {options.map((option) => (
              <ListboxOption key={option.value} value={option.value} as={Fragment}>
                {({ selected, focus }) => (
                  <motion.li
                    variants={optionVariants}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={clsx(
                      "flex w-full cursor-pointer items-center rounded-xl px-3 py-2.5 text-left font-body text-sm outline-none transition-colors",
                      selected
                        ? "bg-ui-primary/10 font-semibold text-ui-primary"
                        : "text-ui-text hover:bg-ui-front",
                      focus && "bg-ui-front"
                    )}
                  >
                    {option.label}
                  </motion.li>
                )}
              </ListboxOption>
            ))}
          </motion.ul>
        </ListboxOptions>
      </div>
    </Listbox>
  )
}
