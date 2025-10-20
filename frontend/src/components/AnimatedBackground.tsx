// An animated background component

import React from "react"
import bgVideo from "@assets/bg.webm"
import { motion } from "framer-motion"

// Props type definition for AnimatedBackground component
type AnimatedBackgroundProps = {
  children?: React.ReactNode
  className?: string
}

// Background component with video animation and content overlay
export const AnimatedBackground = ({ children, className = "" }: AnimatedBackgroundProps) => {
  return (
    <section className={`relative h-full w-auto overflow-hidden ${className}`}>
      {/* Background video with accessibility considerations */}
      <motion.video
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
        animate={{ opacity: 0.5 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      />
      {/* Content container with higher z-index to appear above video */}
      <div className="relative z-10 flex h-full w-full flex-col items-center justify-start justify-center">
        {children}
      </div>
    </section>
  )
}
