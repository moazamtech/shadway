"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import Lenis from "lenis"

export function LenisScroll() {
  const pathname = usePathname()

  // Disable Lenis on /docs and /component-generator paths
  const shouldDisableLenis = pathname?.startsWith("/docs") || pathname?.startsWith("/component-generator")

  useEffect(() => {
    if (shouldDisableLenis) return

    const lenis = new Lenis({
      duration: 0.8,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1,
      smoothTouch: false,
      touchMultiplier: 2,
      infinite: false,
    })

    function raf(time: number) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    requestAnimationFrame(raf)

    return () => {
      lenis.destroy()
    }
  }, [shouldDisableLenis])

  return null
}
