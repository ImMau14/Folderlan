import React, { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"

import { ToastProvider } from "@toast/context/ToastContext"
import { DatabaseProvider } from "@database/context/DatabaseContext"
import { ThemeProvider } from "@theme/context/ThemeContext"
import { I18nProvider } from "@i18n/context/I18nContext"
import { AuthProvider } from "@auth/context/AuthContext"

import { App } from "@app/App"

import "@shared/styles/global.css"
import "@shared/styles/fonts.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <DatabaseProvider>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </DatabaseProvider>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </I18nProvider>
  </StrictMode>
)
