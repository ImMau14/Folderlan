// SetupPage - Component that handles initial database creation, owner registration, and login.
// The SetupPage, where the user can set up the application

import { useEffect, useState, useCallback, type FC } from 'react'
import { AnimatePresence, type Transition } from 'framer-motion'

import { setPageName } from '@utils/setPageName'
import ApiClient from '@utils/ApiClient'

import AnimatedBackground from '@components/AnimatedBackground'
import GlobalControlsOverlay from '@components/GlobalControlsOverlay'

import { useI18n } from '@contexts/I18nContext'
import { useToast } from '@contexts/ToastContext'
import { useAuth } from '@contexts/AuthContext'

import SetupWelcome from './components/SetupWelcome'
import SetupForm from './components/SetupForm'

// OperationResult describes a simple boolean result with an optional message.
type OperationResult = { ok: boolean; message?: string }

export const SetupPage: FC = () => {
  // Local view state: whether to show the form or the welcome screen.
  const [onForm, setOnForm] = useState(false)
  const { login } = useAuth()

  const { toast } = useToast()
  const { t } = useI18n()

  // RegisterOwnerRequest performs three sequential operations:
  // 1) Initialize database, 2) Register owner, 3) Log in and save token.
  const registerOwnerRequest = useCallback(
    async (username: string, password: string): Promise<OperationResult> => {
      const client = new ApiClient()

      // 1) Initialize Database
      try {
        const initDbRes = await client.initDb()

        // Validate result; treat falsy or explicit ok:false as failure.
        if (!initDbRes || !initDbRes.success) {
          const rawMessage = initDbRes?.error?.message ?? undefined
          const fallbackMessage = t('setup.toast.unexpectedErrorDescription')
          const msg = rawMessage ?? fallbackMessage
          toast({
            type: 'error',
            title: t('setup.toast.databaseCreateErrorTitle'),
            description: t('setup.toast.databaseCreateErrorDescription', { message: msg }),
            duration: 4000,
          })
          console.warn('initDb failed:', initDbRes)
          return { ok: false, message: msg }
        }

        // Show single success toast after DB is created.
        toast({
          type: 'success',
          title: t('setup.toast.databaseCreatedTitle'),
          description: t('setup.toast.databaseCreatedDescription'),
          duration: 2000,
        })
      } catch (err) {
        console.error('initDb threw:', err)
        const msg = t('setup.toast.databaseNetworkErrorDescription')
        toast({
          type: 'error',
          title: t('setup.toast.databaseNetworkErrorTitle'),
          description: msg,
          duration: 4000,
        })
        return { ok: false, message: msg }
      }

      // 2) Register Owner
      try {
        const registerRes = await client.ownerRegister(username, password)

        if (!registerRes || !registerRes.success) {
          const msg = registerRes?.error?.message ?? t('setup.toast.unexpectedErrorDescription')
          toast({
            type: 'error',
            title: t('setup.toast.registrationFailedTitle'),
            description: t('setup.toast.registrationFailedDescription', { message: msg }),
            duration: 4000,
          })
          console.warn('ownerRegister failed:', registerRes)
          return { ok: false, message: msg }
        }

        // Show single success toast after owner is registered.
        toast({
          type: 'success',
          title: t('setup.toast.ownerRegisteredTitle'),
          description: t('setup.toast.ownerRegisteredDescription', { username }),
          duration: 2000,
        })
      } catch (err) {
        console.error('ownerRegister threw:', err)
        const msg = t('setup.toast.registrationNetworkErrorDescription')
        toast({
          type: 'error',
          title: t('setup.toast.registrationNetworkErrorTitle'),
          description: msg,
          duration: 4000,
        })
        return { ok: false, message: msg }
      }

      // 3) Login
      try {
        const loginRes = await client.login(username, password)

        if (!loginRes || !loginRes.success) {
          const msg = loginRes?.error?.message ?? t('setup.toast.unexpectedErrorDescription')
          toast({
            type: 'error',
            title: t('setup.toast.loginFailedTitle'),
            description: t('setup.toast.loginFailedDescription', { message: msg }),
            duration: 4000,
          })
          console.warn('login failed:', loginRes)
          return { ok: false, message: msg }
        }

        const token = loginRes?.data?.token
        if (!token) {
          const msg = t('setup.toast.loginNoTokenDescription')
          toast({
            type: 'error',
            title: t('setup.toast.loginNoTokenTitle'),
            description: msg,
            duration: 4000,
          })
          return { ok: false, message: msg }
        }

        login(token)

        // Show single success toast after login success.
        toast({
          type: 'success',
          title: t('setup.toast.loginSuccessTitle'),
          description: t('setup.toast.loginSuccessDescription'),
          duration: 2000,
        })

        return { ok: true }
      } catch (err) {
        console.error('login threw:', err)
        const msg = t('setup.toast.loginErrorDescription')
        toast({
          type: 'error',
          title: t('setup.toast.loginErrorTitle'),
          description: msg,
          duration: 4000,
        })
        return { ok: false, message: msg }
      }
    },
    [t, toast, login]
  )

  // Exposed submit handler used by the child form.
  // This keeps SetupPage solely responsible for sending/processing.
  const onRegister = useCallback(
    async (username: string, password: string) => {
      return await registerOwnerRequest(username, password)
    },
    [registerOwnerRequest]
  )

  useEffect(() => {
    setPageName(onForm ? t('setup.formTitle') : t('setup.welcomeTitle'))
  }, [onForm, t])

  const cardTransition: Transition = { duration: 0.35, ease: [0.16, 1, 0.3, 1] }

  return (
    <AnimatedBackground className="flex h-dvh w-full flex-col items-center justify-center">
      <div className="relative flex h-full w-full items-center justify-center">
        <AnimatePresence>
          {!onForm ? (
            <SetupWelcome
              key="welcome"
              onStart={() => setOnForm(true)}
              cardTransition={cardTransition}
            />
          ) : (
            <SetupForm key="form" cardTransition={cardTransition} onRegister={onRegister} />
          )}
        </AnimatePresence>

        <GlobalControlsOverlay />
      </div>
    </AnimatedBackground>
  )
}

export default SetupPage
