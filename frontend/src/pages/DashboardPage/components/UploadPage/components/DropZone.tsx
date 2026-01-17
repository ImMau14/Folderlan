// DropZone component allows users to drag-and-drop or select files for upload.

import { useRef, useState, type DragEvent, type ChangeEvent, type FC, useMemo } from 'react'
import { FaCloudUploadAlt } from 'react-icons/fa'

import clsx from 'clsx'

import FloatingContainer from '../../FloatingContainer'

interface DropZoneProps {
  onFilesChange?: (files: File[]) => void
  accept?: string
  initialFiles?: File[]
}

const DropZone: FC<DropZoneProps> = ({ onFilesChange, accept, initialFiles = [] }) => {
  // Manage selected files state.
  const [files, setFiles] = useState<File[]>(initialFiles)
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Adds new files, avoiding duplicates.
  const addFiles = (incoming: FileList | File[]) => {
    const arr = Array.from(incoming)
    const merged = [...files]
    for (const f of arr) {
      const exists = merged.some(
        (m) => m.name === f.name && m.size === f.size && m.lastModified === f.lastModified
      )
      if (!exists) merged.push(f)
    }
    setFiles(merged)
    console.log('DropZone files:', merged)
    onFilesChange?.(merged)
  }

  // Handle drag enter event.
  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  }

  // Handle drag over event.
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  }

  // Handle drag leave event.
  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }

  // Handle drop event and add dropped files.
  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer?.files && e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
  }

  // Handle file input change event.
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length) addFiles(e.target.files)
    e.currentTarget.value = ''
  }

  // Triggers hidden file input click.
  const openFileDialog = () => inputRef.current?.click()

  // Render UI with drag-and-drop area and file selector.
  return (
    <FloatingContainer className="animate-fall-on-1">
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={useMemo(
          () =>
            clsx(
              'flex h-full w-full flex-col items-center justify-center rounded-2xl border-4 border-dashed p-6',
              dragActive ? 'border-ui-primary bg-ui-primary/5' : 'border-ui-border bg-green-700/5'
            ),
          [dragActive]
        )}
        aria-label="Drop files here (drag only). Use Select files button to open file picker."
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          className="hidden"
          onChange={handleInputChange}
        />

        <FaCloudUploadAlt className="mb-4 text-8xl text-green-800/80" />

        <h1 className="font-heading text-3xl tracking-wide text-ui-text">Upload Files</h1>
        <span className="font-body">Drag your files here or select them</span>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            openFileDialog()
          }}
          className="my-4 flex items-center justify-center rounded-full bg-ui-primary px-6 py-2 font-body text-sm font-semibold tracking-wide text-white"
        >
          Select files
        </button>
      </div>
    </FloatingContainer>
  )
}

export default DropZone
