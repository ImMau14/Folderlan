import { type FC, useMemo, useState } from 'react'
import { GiFiles } from 'react-icons/gi'
import { FaPlay, FaStop } from 'react-icons/fa6'

import FloatingContainer from '../../../FloatingContainer'
import FileContainer from './components/FileContainer'

interface DropZoneProps {
  files: File[]
}

type FileKey = string

export const FileQueue: FC<DropZoneProps> = ({ files }) => {
  const [progress, setProgress] = useState<Record<FileKey, number>>({})
  const [statusMap, setStatusMap] = useState<
    Record<FileKey, 'idle' | 'uploading' | 'paused' | 'done'>
  >({})

  const fileKeys = useMemo(() => files.map((f) => `${f.name}-${f.size}-${f.lastModified}`), [files])

  const setFileStatus = (key: FileKey, status: 'idle' | 'uploading' | 'paused' | 'done') =>
    setStatusMap((s) => ({ ...s, [key]: status }))
  const setFileProgress = (key: FileKey, value: number) =>
    setProgress((p) => ({ ...p, [key]: Math.max(0, Math.min(100, Math.round(value))) }))

  const handleToggleStartPause = (key: FileKey) => {
    const current = statusMap[key] || 'idle'
    if (current === 'uploading') {
      setFileStatus(key, 'paused')
      // abort logic (AbortController) si lo implementas
    } else {
      setFileStatus(key, 'uploading')
      simulateUpload(key)
    }
  }

  const handleRemoveFile = (key: FileKey) => {
    setFileStatus(key, 'idle')
    setFileProgress(key, 0)
    // eliminar de la lista fuente si la manejas fuera
  }

  const handleStartAll = () => {
    fileKeys.forEach((k) => {
      setFileStatus(k, 'uploading')
      simulateUpload(k)
    })
  }

  const handlePauseAll = () => {
    fileKeys.forEach((k) => setFileStatus(k, 'paused'))
    // abort controllers si aplicas subida real
  }

  const simulateUpload = (key: FileKey) => {
    if (statusMap[key] === 'uploading' && (progress[key] ?? 0) > 0) return
    let cur = progress[key] ?? 0
    const step = () => {
      const s = statusMap[key] ?? 'uploading'
      if (s !== 'uploading') return
      cur += Math.floor(Math.random() * 10) + 5
      if (cur >= 100) {
        setFileProgress(key, 100)
        setFileStatus(key, 'done')
        return
      }
      setFileProgress(key, cur)
      setTimeout(step, 300)
    }
    setTimeout(step, 300)
  }

  return (
    <FloatingContainer className="animate-fall-on-2 brightness-[99%] filter">
      <div className="relative flex h-full w-full flex-col gap-4">
        <h1 className="font-heading text-3xl tracking-wide text-ui-text">File Queue</h1>

        <div className="flex h-full w-full flex-col items-center justify-center">
          {files.length === 0 ? (
            <>
              <GiFiles className="mb-4 text-9xl text-green-800/80" />
              <h2 className="font-heading text-3xl tracking-wide text-ui-text">Empty Queue</h2>
              <p className="px-8 pb-20 text-center font-body text-ui-text">
                Your recently uploaded or pending files will appear here
              </p>
            </>
          ) : (
            <div className="stagger-group flex h-full w-full flex-col gap-2">
              {files.map((f, index) => {
                const key = fileKeys[index]
                return (
                  <FileContainer
                    key={key}
                    file={f}
                    percent={progress[key] ?? 0}
                    status={statusMap[key] ?? 'idle'}
                    onToggleStartPause={() => handleToggleStartPause(key)}
                    onRemove={() => handleRemoveFile(key)}
                  />
                )
              })}
            </div>
          )}
        </div>

        {files.length !== 0 && (
          <div className="absolute right-0 top-0 flex justify-center gap-2">
            <button
              onClick={handleStartAll}
              className="ease rounded-xl border-2 border-ui-border-muted/50 bg-ui-front p-2 shadow-ui-2 duration-150 hover:scale-110"
              aria-label="Iniciar todas las subidas"
              title="Iniciar todo"
            >
              <FaPlay className="text-ui-text/80" aria-hidden />
              <span className="sr-only">Iniciar todo</span>
            </button>

            <button
              onClick={handlePauseAll}
              className="ease rounded-xl border-2 border-ui-border-muted/50 bg-ui-front p-2 shadow-ui-2 duration-150 hover:scale-110"
              aria-label="Pausar todas las subidas"
              title="Pausar todo"
            >
              <FaStop className="text-ui-text/80" aria-hidden />
              <span className="sr-only">Pausar todo</span>
            </button>
          </div>
        )}
      </div>
    </FloatingContainer>
  )
}

export default FileQueue
