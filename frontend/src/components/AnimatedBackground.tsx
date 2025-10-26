// An animated background component

import React, { useEffect, useRef, useState, useCallback } from "react"
import bgVideo from "@assets/bg.webm"
import { motion } from "framer-motion"

// Props type definition for AnimatedBackground component
type AnimatedBackgroundProps = {
  children?: React.ReactNode
  className?: string
  loadTimeoutMs?: number
}

// Background component with video animation and content overlay
export const AnimatedBackground = ({
  children,
  className = "",
  loadTimeoutMs = 5000,
}: AnimatedBackgroundProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [isReady, setIsReady] = useState(false)
  const timeoutRef = useRef<number | null>(null)

  // Mark Ready: set state and clear fallback timeout
  // Stable callback version (doesn't read isReady) so it can be used safely in useEffect deps
  const markReady = useCallback(() => {
    // set state unconditionally (no isReady read) — safe and avoids stale closure issues
    setIsReady(true)
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return

    // If already buffered enough, mark ready immediately
    if (v.readyState >= 4) {
      markReady()
      return
    }

    const onCanPlayThrough = () => markReady()
    const onLoadedData = () => markReady()
    const onPlaying = () => markReady()

    v.addEventListener("canplaythrough", onCanPlayThrough)
    v.addEventListener("loadeddata", onLoadedData)
    v.addEventListener("playing", onPlaying)

    // Try to start playback programmatically; capture any autoplay errors
    const tryPlay = async () => {
      try {
        await v.play()
      } catch (err) {
        // Autoplay may be blocked; fallback to showing when frames are available or timeout.
        console.warn("Video autoplay prevented or failed to play programmatically:", err)
      }
    }
    tryPlay().catch(() => {})

    // Fallback: force-ready after timeout to avoid indefinite hidden state
    timeoutRef.current = window.setTimeout(() => {
      markReady()
    }, loadTimeoutMs)

    return () => {
      v.removeEventListener("canplaythrough", onCanPlayThrough)
      v.removeEventListener("loadeddata", onLoadedData)
      v.removeEventListener("playing", onPlaying)
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [loadTimeoutMs, markReady])

  return (
    <section className={`relative h-full w-auto overflow-hidden ${className}`}>
      {/* Background video with accessibility considerations */}
      <motion.video
        ref={videoRef}
        src={bgVideo}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true" // Hide from screen readers since it's decorative
        className="
          pointer-events-none absolute left-1/2 top-0
          min-h-full min-w-full
          -translate-x-1/2 select-none
          object-cover object-top
          opacity-50
        "
        initial={{ opacity: 0 }}
        animate={isReady ? { opacity: 0.5 } : { opacity: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      />
      {/* Content container with higher z-index to appear above video */}
      <div className="relative z-10 flex h-full w-full flex-col items-center justify-start justify-center">
        {children}
      </div>
    </section>
  )
}
