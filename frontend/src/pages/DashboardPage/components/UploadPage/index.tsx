import { type FC, useState } from "react"

import DropZone from "./components/DropZone"
import FileQueue from "./components/FileQueue"

export const UploadPage: FC = () => {
  const [files, setFiles] = useState<File[]>([])

  return (
    <div className="grid h-full w-full grid-cols-2 gap-4 p-4 pt-0">
      <DropZone onFilesChange={(f) => setFiles(f)} />
      <FileQueue files={files} />
    </div>
  )
}

export default UploadPage
