import { type FC } from 'react'

import { FaCloudUploadAlt } from 'react-icons/fa'

export const UploadPage: FC = () => {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="animate-fall-on-1 flex w-152 flex-col items-center gap-4 rounded-3xl bg-ui-base p-8 shadow-ui-0">
        <div className="flex w-full flex-col items-center justify-center rounded-2xl border-4 border-dashed border-ui-border bg-green-700/5 p-6">
          <FaCloudUploadAlt className="text-9xl text-green-800/80" />

          <h1 className="font-heading text-3xl tracking-wide text-ui-text">Upload Files</h1>
          <span className="font-body">Drag your files here or select them</span>
          <button className="my-4 flex items-center justify-center rounded-full bg-ui-primary px-6 py-2 font-body text-sm font-semibold tracking-wide text-white">
            Select files
          </button>
        </div>
      </div>
    </div>
  )
}

export default UploadPage
