import { type FC, useEffect } from 'react'

import { GiFiles } from 'react-icons/gi'
import { FaFile } from 'react-icons/fa6'

import FloatingContainer from '../../FloatingContainer'

import formatBytes from '@utils/formatBytes'

interface DropZoneProps {
  files: File[]
}

export const FileQueue: FC<DropZoneProps> = ({ files }) => {
  useEffect(() => {
    console.log(files)
  }, [files])

  return (
    <FloatingContainer className="animate-fall-on-2 brightness-[99%] filter">
      <div className="flex h-full w-full flex-col gap-4">
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
            <div className="flex h-full w-full flex-col gap-2 stagger-group">
              {files.map((f, index) => (
                <article
                  key={index}
                  className="flex w-full flex-row items-center gap-4 rounded-2xl border-2 border-ui-border-muted/50 bg-ui-front p-3 shadow-sm duration-100 hover:scale-105"
                >
                  <div className="rounded-xl border-2 border-ui-border-muted/40 bg-ui-base p-2">
                    <FaFile className="text-3xl text-ui-text/80" />
                  </div>

                  <div className="flex h-full w-full flex-col justify-between gap-1">
                    <h1 className="font-body font-semibold tracking-wide text-ui-text">{f.name}</h1>
                    <p className="font-body text-xs text-ui-text-muted">{formatBytes(f.size)}</p>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-ui-back" />
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </FloatingContainer>
  )
}

export default FileQueue
