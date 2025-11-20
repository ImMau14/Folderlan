import React, { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { ToastProvider } from "@components/ToastProvider"
import { I18nProvider } from "@i18n/I18nProvider"
import { ThemeProvider } from "@theme/ThemeProvider"
import { App } from "@/App.tsx"
import "@styles/global.css"
import "@styles/fonts.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <ThemeProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </ThemeProvider>
      </I18nProvider>
    </BrowserRouter>
  </StrictMode>
)
