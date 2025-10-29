"use client"

import { MeshGradient } from "@paper-design/shaders-react"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { ReactNode } from "react"

interface MeshBackgroundProps {
  /**
   * Colors for the mesh gradient in hex or hsl format
   * @default ["#72b9bb", "#b5d9d9", "#ffd1bd", "#ffebe0", "#8cc5b8", "#dbf4a4"]
   */
  colors?: string[]

  /**
   * Distortion intensity of the mesh
   * @default 0.8
   * @range 0-2
   */
  distortion?: number

  /**
   * Swirl/rotation effect intensity
   * @default 0.6
   * @range 0-1
   */
  swirl?: number

  /**
   * Animation speed multiplier
   * @default 0.42
   * @range 0-1
   */
  speed?: number

  /**
   * Horizontal offset of the mesh
   * @default 0.08
   * @range 0-1
   */
  offsetX?: number

  /**
   * Vertical offset of the mesh
   * @default 0
   * @range 0-1
   */
  offsetY?: number

  /**
   * Opacity of the veil overlay (0-1)
   * @default "bg-white/20 dark:bg-black/25"
   */
  veilClassName?: string

  /**
   * Additional CSS classes for the container
   */
  className?: string

  /**
   * Content to overlay on top of the mesh background
   */
  children?: ReactNode

  /**
   * Whether to show grain effect
   * @default false
   */
  showGrain?: boolean
}

/**
 * Mesh Background Component
 *
 * A beautiful, animated mesh gradient background component built with WebGL shaders.
 * Perfect for hero sections, landing pages, and full-screen backgrounds.
 *
 * @example
 * ```tsx
 * import { MeshBackground } from "@/components/ui/mesh-background"
 *
 * export default function Hero() {
 *   return (
 *     <MeshBackground
 *       colors={["#72b9bb", "#b5d9d9", "#ffd1bd"]}
 *       distortion={0.8}
 *       speed={0.5}
 *     >
 *       <div className="relative z-10 flex items-center justify-center min-h-screen">
 *         <h1 className="text-4xl font-bold text-white">Welcome</h1>
 *       </div>
 *     </MeshBackground>
 *   )
 * }
 * ```
 */
export function MeshBackground({
  colors = ["#72b9bb", "#b5d9d9", "#ffd1bd", "#ffebe0", "#8cc5b8", "#dbf4a4"],
  distortion = 0.8,
  swirl = 0.6,
  speed = 0.42,
  offsetX = 0.08,
  offsetY = 0,
  veilClassName = "bg-white/20 dark:bg-black/25",
  className,
  children,
  showGrain = false,
}: MeshBackgroundProps) {
  const [dimensions, setDimensions] = useState({ width: 1920, height: 1080 })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    updateDimensions()
    window.addEventListener("resize", updateDimensions)
    return () => window.removeEventListener("resize", updateDimensions)
  }, [])

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden bg-background",
        className
      )}
    >
      {/* Fixed background container */}
      <div className="fixed inset-0 w-screen h-screen pointer-events-none">
        {mounted && (
          <>
            <MeshGradient
              style={{
                width: "100%",
                height: "100%",
                display: "block",
              }}
              colors={colors}
              distortion={distortion}
              swirl={swirl}
              grainMixer={showGrain ? 0.5 : 0}
              grainOverlay={showGrain ? 0.3 : 0}
              speed={speed}
              offsetX={offsetX}
              offsetY={offsetY}
            />
            {/* Veil overlay for better text readability */}
            <div className={cn("absolute inset-0 pointer-events-none", veilClassName)} />
          </>
        )}
      </div>

      {/* Content layer */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}

export type { MeshBackgroundProps }
