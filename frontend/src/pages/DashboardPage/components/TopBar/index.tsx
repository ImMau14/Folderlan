import { type FC } from "react"

import { FaUserCircle } from "react-icons/fa"
import { IoLogOut } from "react-icons/io5"

export const TopBar: FC = () => {
  return (
    <div className="flex items-center justify-between p-4">
      <div className="flex flex-row items-center gap-4">
        <FaUserCircle className="text-3xl text-ui-text opacity-80" />
        <div className="flex flex-col">
          <h2 className="font-heading text-sm tracking-wide text-ui-text">Welcome, Mau</h2>
          <span className="font-body text-xs text-ui-text-muted">Owner account</span>
        </div>
      </div>

      <div className="flex flex-row items-center gap-4">
        <button className="flex items-center justify-center gap-2 rounded-full bg-ui-base/80 px-4 py-1 text-ui-text shadow-ui-1">
          <IoLogOut className="text-base opacity-80" />
          <span className="font-body text-xs font-semibold tracking-wide">Log Out</span>
        </button>
      </div>
    </div>
  )
}

export default TopBar
