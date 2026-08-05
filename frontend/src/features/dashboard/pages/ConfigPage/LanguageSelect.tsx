import { Fragment, useMemo } from "react"
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/react"
import { motion } from "framer-motion"
import { Check, ChevronDown, Languages } from "lucide-react"
import clsx from "clsx"

import { SUPPORTED_LOCALES, useI18n } from "@i18n/context/I18nContext"

const LANGUAGE_LABEL_KEYS: Record<string, string> = {
  en: "language.english",
  es: "language.spanish",
  it: "language.italian",
  pt: "language.portuguese",
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

export default function LanguageSelect() {
  const { locale, setLocale, t } = useI18n()

  const options = useMemo(
    () =>
      SUPPORTED_LOCALES.map((code) => ({
        code,
        label: t(LANGUAGE_LABEL_KEYS[code] ?? LANGUAGE_LABEL_KEYS.en),
      })).filter((option) => Boolean(option.label)),
    [t]
  )

  const currentOption = useMemo(
    () => options.find((option) => option.code === locale) ?? options[0],
    [locale, options]
  )

  return (
    <Listbox value={locale} onChange={setLocale}>
      <div className="relative w-full">
        <ListboxButton
          className={clsx(
            "flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border bg-ui-front px-4 py-3 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-primary/40",
            "border-ui-border-muted hover:border-ui-primary data-[open]:border-ui-primary"
          )}
        >
          <span className="flex min-w-0 items-center gap-3">
            <Languages className="h-4 w-4 shrink-0 text-ui-primary" />
            <span className="truncate font-body text-sm font-medium text-ui-text">
              {currentOption?.label ?? locale.toUpperCase()}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="rounded-md bg-ui-highlight px-2 py-0.5 font-body text-[11px] font-bold uppercase tracking-wider text-ui-text-muted">
              {locale.toUpperCase()}
            </span>
            <ChevronDown className="h-4 w-4 text-ui-text-muted transition-transform duration-200 data-[open]:rotate-180" />
          </span>
        </ListboxButton>

        <ListboxOptions
          transition
          className={clsx(
            "glass absolute left-0 right-0 top-full z-50 mt-2 origin-top overflow-hidden rounded-2xl p-2 backdrop-blur-md",
            "transition duration-150 ease-[cubic-bezier(0.2,0,0,1)]",
            "data-[closed]:scale-[0.98] data-[open]:scale-100 data-[closed]:opacity-0 data-[open]:opacity-100",
            "focus:outline-none"
          )}
        >
          <motion.ul
            variants={listVariants}
            initial="hidden"
            animate="visible"
            className="flex max-h-60 flex-col overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {options.map((option) => (
              <ListboxOption key={option.code} value={option.code} as={Fragment}>
                {({ selected, focus }) => (
                  <motion.li
                    variants={optionVariants}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={clsx(
                      "flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left outline-none transition-colors",
                      selected
                        ? "bg-ui-primary/10 font-semibold text-ui-primary"
                        : "text-ui-text hover:bg-ui-front",
                      focus && "bg-ui-front"
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate font-body text-sm">
                      {option.label}
                    </span>
                    <span className="shrink-0 font-body text-[11px] font-bold uppercase tracking-wider text-ui-text-muted">
                      {option.code.toUpperCase()}
                    </span>
                    {selected && <Check className="h-4 w-4 shrink-0" />}
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
