"use client"

import { MeshBackground } from "@/components/ui/mesh-background"
import { Button } from "@/components/ui/button"

/**
 * Basic Mesh Background Example
 * Shows how to use the MeshBackground component with default settings
 */
export function MeshBackgroundBasic() {
  return (
    <MeshBackground className="min-h-screen">
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-6xl font-bold text-white">
            Welcome to Shadway
          </h1>
          <p className="text-lg text-white/90 max-w-2xl">
            Beautiful mesh gradient backgrounds powered by WebGL shaders
          </p>
        </div>
      </div>
    </MeshBackground>
  )
}

/**
 * Custom Colors Example
 * Shows how to customize the mesh gradient colors
 */
export function MeshBackgroundCustomColors() {
  return (
    <MeshBackground
      colors={["#ff6b6b", "#4ecdc4", "#45b7d1", "#f7b731"]}
      className="min-h-screen"
    >
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-6xl font-bold text-white">
            Custom Colors
          </h1>
          <p className="text-lg text-white/90">
            Customize the mesh with your brand colors
          </p>
        </div>
      </div>
    </MeshBackground>
  )
}

/**
 * Fast Animation Example
 * Shows how to speed up the animation
 */
export function MeshBackgroundFastAnimation() {
  return (
    <MeshBackground
      speed={0.8}
      distortion={1.2}
      swirl={0.8}
      className="min-h-screen"
    >
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-6xl font-bold text-white">
            Fast Animation
          </h1>
          <p className="text-lg text-white/90">
            High distortion and fast movement
          </p>
        </div>
      </div>
    </MeshBackground>
  )
}

/**
 * Subtle Effect Example
 * Shows how to create a subtle, minimal effect
 */
export function MeshBackgroundSubtle() {
  return (
    <MeshBackground
      speed={0.2}
      distortion={0.3}
      swirl={0.2}
      className="min-h-screen"
    >
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-6xl font-bold text-white">
            Subtle Effect
          </h1>
          <p className="text-lg text-white/90">
            Low distortion for a calm, minimal look
          </p>
        </div>
      </div>
    </MeshBackground>
  )
}

/**
 * Hero Section Example
 * Shows how to use the mesh background with a complete hero section
 */
export function MeshBackgroundHero() {
  return (
    <MeshBackground
      colors={["#667eea", "#764ba2", "#f093fb", "#4facfe"]}
      distortion={0.9}
      speed={0.5}
      className="min-h-screen"
    >
      <div className="flex flex-col items-center justify-center min-h-screen px-4">
        <div className="text-center space-y-8 max-w-3xl">
          <h1 className="text-5xl md:text-7xl font-bold text-white text-balance">
            Build Amazing Things
          </h1>
          <p className="text-xl md:text-2xl text-white/80 text-pretty">
            Create stunning user experiences with our collection of beautiful,
            performant components and effects.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
            <Button size="lg" className="px-8">
              Get Started
            </Button>
            <Button size="lg" variant="outline">
              Learn More
            </Button>
          </div>
        </div>
      </div>
    </MeshBackground>
  )
}

/**
 * Newsletter Section Example
 * Shows how to use the mesh background for a newsletter signup
 */
export function MeshBackgroundNewsletter() {
  return (
    <MeshBackground
      colors={["#ffd1bd", "#ffebe0", "#ffc0d9"]}
      distortion={0.6}
      speed={0.35}
      veilClassName="bg-gradient-to-b from-white/30 to-white/10 dark:from-black/40 dark:to-black/20"
      className="min-h-screen"
    >
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="text-center space-y-6 max-w-2xl">
          <h2 className="text-4xl md:text-5xl font-bold text-white">
            Stay Updated
          </h2>
          <p className="text-lg text-white/90">
            Get the latest news, updates, and exclusive content delivered to your inbox.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-6 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
            />
            <Button size="lg">Subscribe</Button>
          </div>
        </div>
      </div>
    </MeshBackground>
  )
}
