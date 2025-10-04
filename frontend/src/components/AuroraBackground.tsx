// AuroraBackground component providing an animated gradient background effect
// with customizable radial gradient and dark/light mode support

import React, { ReactNode } from "react"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// Utility function to merge Tailwind classes with conditional classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Props interface for AuroraBackground component
interface AuroraBackgroundProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  showRadialGradient?: boolean
}

export const AuroraBackground = ({
  className,
  children,
  showRadialGradient = true,
  ...props
}: AuroraBackgroundProps) => {
  return (
    <main>
      <div
        className={cn(
          "transition-bg relative flex h-[100vh] flex-col items-center justify-center bg-zinc-50 text-slate-950 dark:bg-zinc-900",
          className
        )}
        {...props}
      >
        {/* Background container with custom CSS properties for gradient colors */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={
            {
              // CSS custom properties for gradient colors and animations
              "--aurora":
                "repeating-linear-gradient(100deg,var(--green-600)_10%,var(--green-500)_15%,var(--green-400)_20%,var(--green-300)_25%,var(--green-200)_30%)",
              "--dark-gradient":
                "repeating-linear-gradient(100deg,#000_0%,#000_7%,transparent_10%,transparent_12%,#000_16%)",
              "--white-gradient":
                "repeating-linear-gradient(100deg,#fff_0%,#fff_7%,transparent_10%,transparent_12%,#fff_16%)",

              // Color definitions for the aurora effect
              "--green-200": "#ecffd6",
              "--green-300": "#d2ff9d",
              "--green-400": "#b6ff5a",
              "--green-500": "#8cf11a",
              "--green-600": "#62b60e",
              "--black": "#000",
              "--white": "#fff",
              "--transparent": "transparent",
            } as React.CSSProperties
          }
        >
          {/* Animated aurora effect layer */}
          <div
            className={cn(
              `after:animate-aurora pointer-events-none absolute -inset-[10px] 
              [background-image:var(--white-gradient),var(--aurora)] 
              [background-size:300%,_200%] [background-position:50%_50%,50%_50%] 
              opacity-50 blur-[10px] invert filter will-change-transform 
              [--aurora:repeating-linear-gradient(100deg,var(--green-600)_10%,var(--green-500)_15%,var(--green-400)_20%,var(--green-300)_25%,var(--green-200)_30%)] 
              [--dark-gradient:repeating-linear-gradient(100deg,var(--black)_0%,var(--black)_7%,var(--transparent)_10%,var(--transparent)_12%,var(--black)_16%)] 
              [--white-gradient:repeating-linear-gradient(100deg,var(--white)_0%,var(--white)_7%,var(--transparent)_10%,var(--transparent)_12%,var(--white)_16%)] 
              after:absolute after:inset-0 
              after:[background-image:var(--white-gradient),var(--aurora)] 
              after:[background-size:200%,_100%] after:[background-attachment:fixed] 
              after:mix-blend-difference after:content-[""] 
              dark:[background-image:var(--dark-gradient),var(--aurora)] dark:invert-0 
              after:dark:[background-image:var(--dark-gradient),var(--aurora)]`,

              // Conditionally apply radial gradient mask
              showRadialGradient &&
                `[mask-image:radial-gradient(ellipse_at_100%_0%,black_10%,var(--transparent)_70%)]`
            )}
          ></div>
        </div>
        {children}
      </div>
    </main>
  )
}
