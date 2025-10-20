// The SetupPage, where the user can set up the application

import { useEffect } from "react"
import { setPageName } from "@utils/setPageName"
import { setThemeColor } from "@utils/setThemeColor"

export const SetupPage = () => {
  useEffect(() => {
    setThemeColor("#f5f6f7")
    setPageName("Setup")
  }, [])

  return (
    <main className="flex h-full w-full flex-col items-center justify-center bg-gray-100">
      <h1 className="font-heading font-bold">This will be the setup page</h1>
      <p className="font-body">The database does not exist yet</p>
    </main>
  )
}
