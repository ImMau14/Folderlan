/**
 * Application entry point. Sets up global providers.
 * BrowserRouter is no longer needed; the router is provided inside App.
 */

import React, { StrictMode } from "react"
import { createRoot } from "react-dom/client"

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
              <App />
            </DatabaseProvider>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </I18nProvider>
  </StrictMode>
)
