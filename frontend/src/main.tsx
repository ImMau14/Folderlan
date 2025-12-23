import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import { ToastProvider } from '@contexts/ToastContext'
import { DatabaseProvider } from '@contexts/DatabaseContext'
import { ThemeProvider } from '@contexts/ThemeContext'
import { I18nProvider } from '@contexts/I18nContext'
import { AuthProvider } from '@contexts/AuthContext'

import { App } from '@/App.tsx'

import '@styles/global.css'
import '@styles/fonts.css'

createRoot(document.getElementById('root')!).render(
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
