import { Routes, Route, Navigate } from 'react-router-dom'
import type { FC } from 'react'

import Menu from './components/Menu'
import UploadPage from './components/UploadPage'
import TopBar from './components/TopBar'

function FilesPage() {
  return <div>Files</div>
}
function UserPage() {
  return <div>User</div>
}
function SettingsPage() {
  return <div>Settings</div>
}

export const DashboardPage: FC = () => {
  return (
    <div className="grid h-full w-full grid-cols-[250px_1fr] bg-ui-back">
      <Menu basePath="/dashboard" />

      <main className="grid grid-rows-[auto_1fr]">
        <TopBar />

        <Routes>
          <Route path="upload" element={<UploadPage />} />
          <Route path="files" element={<FilesPage />} />
          <Route path="user" element={<UserPage />} />
          <Route path="settings" element={<SettingsPage />} />

          <Route index element={<Navigate to="upload" replace />} />
          <Route path="*" element={<Navigate to="upload" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default DashboardPage
