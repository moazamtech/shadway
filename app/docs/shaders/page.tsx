"use client"

import { Warp, MeshGradient } from "@paper-design/shaders-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CodeBlock } from "@/components/code-block"
import { Sparkles, Copy, Download, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"

const shadersData = [
  {
    id: "warp",
    name: "Warp Shader",
    description: "A dynamic, flowing shader effect perfect for hero sections",
    icon: Sparkles,
    colors: ["hsl(200, 100%, 20%)", "hsl(160, 100%, 75%)", "hsl(180, 90%, 30%)", "hsl(170, 100%, 80%)"],
    type: "warp",
    defaultProps: { proportion: 0.45, softness: 1, distortion: 0.25, swirl: 0.8, speed: 1 },
  },
  {
    id: "warp-purple",
    name: "Warp Purple",
    description: "Purple-tinted flowing shader for premium feel",
    icon: Sparkles,
    colors: ["hsl(270, 100%, 20%)", "hsl(280, 100%, 60%)", "hsl(290, 100%, 40%)", "hsl(300, 100%, 70%)"],
    type: "warp",
    defaultProps: { proportion: 0.45, softness: 1, distortion: 0.25, swirl: 0.8, speed: 1 },
  },
  {
    id: "warp-orange",
    name: "Warp Orange",
    description: "Warm orange shader for vibrant designs",
    icon: Sparkles,
    colors: ["hsl(20, 100%, 30%)", "hsl(35, 100%, 60%)", "hsl(40, 100%, 50%)", "hsl(50, 100%, 65%)"],
    type: "warp",
    defaultProps: { proportion: 0.45, softness: 1, distortion: 0.25, swirl: 0.8, speed: 1 },
  },
  {
    id: "warp-cyan",
    name: "Warp Cyan",
    description: "Cool cyan shader for modern tech look",
    icon: Sparkles,
    colors: ["hsl(180, 100%, 20%)", "hsl(190, 100%, 50%)", "hsl(200, 100%, 40%)", "hsl(210, 100%, 70%)"],
    type: "warp",
    defaultProps: { proportion: 0.45, softness: 1, distortion: 0.25, swirl: 0.8, speed: 1 },
  },
  {
    id: "newsletter",
    name: "Newsletter",
    description: "Coming soon styled shader with email signup and pink/red tones",
    icon: Sparkles,
    colors: ["hsl(340, 100%, 20%)", "hsl(320, 100%, 75%)", "hsl(350, 90%, 30%)", "hsl(330, 100%, 80%)"],
    type: "warp",
    defaultProps: { proportion: 0.45, softness: 1, distortion: 0.25, swirl: 0.8, speed: 1 },
  },
  {
    id: "mesh-gradient",
    name: "Mesh Gradient",
    description: "Smooth gradient mesh perfect for landing pages and hero sections",
    icon: Sparkles,
    colors: ["#72b9bb", "#b5d9d9", "#ffd1bd", "#ffebe0", "#8cc5b8", "#dbf4a4"],
    type: "mesh",
    defaultProps: { distortion: 0.8, swirl: 0.6, speed: 0.42, offsetX: 0.08 },
  },
]

export default function ShadersPage() {
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<"preview" | "code" | "controls">("preview")
  const [selectedShader, setSelectedShader] = useState(shadersData[0])
  const [dimensions, setDimensions] = useState({ width: 1920, height: 1080 })
  const [mounted, setMounted] = useState(false)

  // Shader properties state
  const [shaderProps, setShaderProps] = useState({
    proportion: 0.45,
    softness: 1,
    distortion: 0.25,
    swirl: 0.8,
    speed: 1,
    offsetX: 0.08,
  })

  useEffect(() => {
    setMounted(true)
    const update = () =>
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  // Update shader props when shader changes
  useEffect(() => {
    if (selectedShader.defaultProps) {
      setShaderProps(prev => ({ ...prev, ...selectedShader.defaultProps }))
    }
    setActiveTab("preview")
  }, [selectedShader.id])

  const warpCode = `import { Warp } from "@paper-design/shaders-react"

export default function WarpShaderHero() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0">
        <Warp
          style={{ height: "100%", width: "100%" }}
          proportion={0.45}
          softness={1}
          distortion={0.25}
          swirl={0.8}
          swirlIterations={10}
          shape="checks"
          shapeScale={0.1}
          scale={1}
          rotation={0}
          speed={1}
          colors={["hsl(200, 100%, 20%)", "hsl(160, 100%, 75%)", "hsl(180, 90%, 30%)", "hsl(170, 100%, 80%)"]}
        />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center px-8">
        <div className="max-w-4xl w-full text-center space-y-8">
          <h1 className="text-white text-5xl md:text-7xl font-sans font-light text-balance">
            Elegant Shader Backgrounds
          </h1>

          <p className="text-white/90 text-xl md:text-2xl font-sans font-light leading-relaxed max-w-3xl mx-auto">
            Beautiful, performant shader effects that enhance your content without overwhelming it.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
            <button className="px-8 py-4 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full text-white font-medium hover:bg-white/30 transition-all duration-300 hover:scale-105">
              Get Started
            </button>
            <button className="px-8 py-4 bg-white rounded-full text-gray-800 font-medium hover:scale-105 transition-transform duration-300">
              View Examples
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}`

  const newsletterCode = `import { Warp } from "@paper-design/shaders-react"

export default function NewsLetter() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0">
        <Warp
          style={{ height: "100%", width: "100%" }}
          proportion={0.45}
          softness={1}
          distortion={0.25}
          swirl={0.8}
          swirlIterations={10}
          shape="checks"
          shapeScale={0.1}
          scale={1}
          rotation={0}
          speed={1}
          colors={["hsl(340, 100%, 20%)", "hsl(320, 100%, 75%)", "hsl(350, 90%, 30%)", "hsl(330, 100%, 80%)"]}
        />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center px-8">
        <div className="max-w-2xl w-full text-center space-y-8">
          <h1 className="text-white text-6xl md:text-7xl font-sans font-light italic">Coming Soon</h1>

          <div className="relative">
            <input
              type="email"
              placeholder="Enter your email"
              className="w-full px-6 py-4 pr-20 text-lg bg-white/20 backdrop-blur-sm border border-white/30 rounded-full text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
            <button className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-transform">
              <svg className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <p className="text-white/90 text-lg font-sans font-light leading-relaxed">
            Don't miss out on the latest news and special content!
          </p>
        </div>
      </div>
    </main>
  )
}`

  const meshGradientCode = `import { MeshGradient } from "@paper-design/shaders-react"
import { useEffect, useState } from "react"

export default function MeshGradientHero() {
  const [dimensions, setDimensions] = useState({ width: 1920, height: 1080 })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const update = () =>
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  return (
    <section className="relative w-full min-h-screen overflow-hidden bg-background flex items-center justify-center">
      <div className="fixed inset-0 w-screen h-screen">
        {mounted && (
          <>
            <MeshGradient
              width={dimensions.width}
              height={dimensions.height}
              colors={["#72b9bb", "#b5d9d9", "#ffd1bd", "#ffebe0", "#8cc5b8", "#dbf4a4"]}
              distortion={0.8}
              swirl={0.6}
              speed={0.42}
              offsetX={0.08}
            />
            <div className="absolute inset-0 pointer-events-none bg-white/20 dark:bg-black/25" />
          </>
        )}
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 w-full">
        <div className="text-center">
          <h1 className="font-bold text-foreground text-balance text-4xl sm:text-5xl md:text-6xl leading-tight mb-6">
            Intelligent AI Agents for <span className="text-primary">Smart Brands</span>
          </h1>
          <p className="text-lg sm:text-xl text-white text-pretty max-w-2xl mx-auto leading-relaxed mb-10">
            Transform your brand and evolve it through AI-driven brand guidelines.
          </p>
          <button className="px-8 py-4 rounded-full border-4 bg-[rgba(63,63,63,1)] border-card text-white hover:bg-[rgba(63,63,63,0.9)] transition-colors">
            Join Waitlist
          </button>
        </div>
      </div>
    </section>
  )
}`

  const getCodeForShader = (shader: typeof shadersData[0]) => {
    if (shader.id === "newsletter") return newsletterCode
    if (shader.type === "mesh") return meshGradientCode
    return warpCode
  }

  const copyCode = async () => {
    try {
      const codeToClip = getCodeForShader(selectedShader)
      await navigator.clipboard.writeText(codeToClip)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handlePropChange = (prop: string, value: number) => {
    setShaderProps(prev => ({ ...prev, [prop]: value }))
  }

  const resetProps = () => {
    if (selectedShader.defaultProps) {
      setShaderProps(prev => ({ ...prev, ...selectedShader.defaultProps }))
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      {/* Header */}
      <div className="space-y-4 mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Shaders & Effects</h1>
        <p className="text-xl text-muted-foreground">
          Powerful WebGL shader effects to create stunning visual experiences. Built with performance in mind.
        </p>
      </div>

      {/* Main Layout - Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left - Shader Cards */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-3">Available Shaders</h2>
          <div className="space-y-2">
            {shadersData.map((shader) => {
              const Icon = shader.icon
              const isSelected = selectedShader.id === shader.id
              return (
                <button
                  key={shader.id}
                  onClick={() => setSelectedShader(shader)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all duration-200 ${isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border/50 bg-muted/30 hover:bg-muted/50 hover:border-border"
                    }`}
                >
                  <div className="flex items-start gap-2.5">
                    <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-foreground truncate">{shader.name}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-2">{shader.description}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Right - Detailed Preview */}
        <div className="lg:col-span-2 space-y-4">
          {/* Component Card */}
          <Card className="overflow-hidden border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                {selectedShader.name}
              </CardTitle>
              <CardDescription>
                {selectedShader.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Preview/Code Toggle Tabs */}
              <div className="space-y-3">
                <div className="flex gap-2 border-b border-border/50 overflow-x-auto">
                  <Button
                    onClick={() => setActiveTab("preview")}
                    variant="ghost"
                    className={`px-4 py-2 rounded-none border-b-2 transition-colors whitespace-nowrap ${activeTab === "preview"
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    Preview
                  </Button>
                  <Button
                    onClick={() => setActiveTab("controls")}
                    variant="ghost"
                    className={`px-4 py-2 rounded-none border-b-2 transition-colors whitespace-nowrap ${activeTab === "controls"
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    Controls
                  </Button>
                  <Button
                    onClick={() => setActiveTab("code")}
                    variant="ghost"
                    className={`px-4 py-2 rounded-none border-b-2 transition-colors whitespace-nowrap ${activeTab === "code"
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    Code
                  </Button>
                </div>

                {/* Preview Tab Content */}
                {activeTab === "preview" && (
                  <div className="relative rounded-lg overflow-hidden border border-border/50 bg-black h-72 flex items-center justify-center">
                    {selectedShader.type === "mesh" && mounted ? (
                      <div style={{ width: "100%", height: "100%" }}>
                        <MeshGradient
                          style={{ width: "100%", height: "100%", display: "block" }}
                          colors={selectedShader.colors as string[]}
                          distortion={shaderProps.distortion}
                          swirl={shaderProps.swirl}
                          speed={shaderProps.speed}
                          offsetX={shaderProps.offsetX}
                        />
                      </div>
                    ) : (
                      <Warp
                        style={{ height: "100%", width: "100%" }}
                        proportion={shaderProps.proportion}
                        softness={shaderProps.softness}
                        distortion={shaderProps.distortion}
                        swirl={shaderProps.swirl}
                        swirlIterations={10}
                        shape="checks"
                        shapeScale={0.1}
                        scale={1}
                        rotation={0}
                        speed={shaderProps.speed}
                        colors={selectedShader.colors as string[]}
                      />
                    )}
                  </div>
                )}

                {/* Controls Tab Content */}
                {activeTab === "controls" && (
                  <div className="space-y-4 py-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-sm text-foreground">Adjust Properties</h3>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={resetProps}
                        className="h-7 text-xs"
                      >
                        Reset to Default
                      </Button>
                    </div>

                    {selectedShader.type === "warp" || selectedShader.id === "newsletter" ? (
                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-semibold text-foreground">Proportion: {shaderProps.proportion.toFixed(2)}</label>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={shaderProps.proportion}
                            onChange={(e) => handlePropChange("proportion", parseFloat(e.target.value))}
                            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-semibold text-foreground">Softness: {shaderProps.softness.toFixed(2)}</label>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.1"
                            value={shaderProps.softness}
                            onChange={(e) => handlePropChange("softness", parseFloat(e.target.value))}
                            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-semibold text-foreground">Distortion: {shaderProps.distortion.toFixed(2)}</label>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.05"
                            value={shaderProps.distortion}
                            onChange={(e) => handlePropChange("distortion", parseFloat(e.target.value))}
                            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-semibold text-foreground">Swirl: {shaderProps.swirl.toFixed(2)}</label>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={shaderProps.swirl}
                            onChange={(e) => handlePropChange("swirl", parseFloat(e.target.value))}
                            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-semibold text-foreground">Speed: {shaderProps.speed.toFixed(2)}</label>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.1"
                            value={shaderProps.speed}
                            onChange={(e) => handlePropChange("speed", parseFloat(e.target.value))}
                            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-semibold text-foreground">Distortion: {shaderProps.distortion.toFixed(2)}</label>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.05"
                            value={shaderProps.distortion}
                            onChange={(e) => handlePropChange("distortion", parseFloat(e.target.value))}
                            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-semibold text-foreground">Swirl: {shaderProps.swirl.toFixed(2)}</label>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={shaderProps.swirl}
                            onChange={(e) => handlePropChange("swirl", parseFloat(e.target.value))}
                            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-semibold text-foreground">Speed: {shaderProps.speed.toFixed(2)}</label>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={shaderProps.speed}
                            onChange={(e) => handlePropChange("speed", parseFloat(e.target.value))}
                            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-semibold text-foreground">Offset X: {shaderProps.offsetX.toFixed(2)}</label>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={shaderProps.offsetX}
                            onChange={(e) => handlePropChange("offsetX", parseFloat(e.target.value))}
                            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Code Tab Content */}
                {activeTab === "code" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-4 py-3 bg-muted/50 rounded-t-lg border border-border/50 border-b-0">
                      <span className="text-xs font-semibold text-muted-foreground">
                        {selectedShader.id === "newsletter" ? "NewsLetter.tsx" : selectedShader.type === "mesh" ? "MeshGradientHero.tsx" : "WarpShaderHero.tsx"}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={copyCode}
                        className="h-7 gap-2 text-xs"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        {copied ? "Copied!" : "Copy Code"}
                      </Button>
                    </div>
                    <div className="bg-muted/30 rounded-b-lg p-4 font-mono text-sm overflow-x-auto border border-border/50 border-t-0 max-h-72">
                      <pre className="text-foreground/80 whitespace-pre-wrap break-words leading-6">
                        {getCodeForShader(selectedShader)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>

              {/* Props Section */}
              <div className="space-y-3 pt-4 border-t border-border/50">
                <h3 className="font-semibold text-sm text-foreground">Key Props</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1 text-sm">
                    <code className="text-xs font-semibold text-primary">proportion</code>
                    <p className="text-muted-foreground text-xs">Effect size (0-1)</p>
                  </div>
                  <div className="space-y-1 text-sm">
                    <code className="text-xs font-semibold text-primary">softness</code>
                    <p className="text-muted-foreground text-xs">Edge smoothness</p>
                  </div>
                  <div className="space-y-1 text-sm">
                    <code className="text-xs font-semibold text-primary">distortion</code>
                    <p className="text-muted-foreground text-xs">Warp intensity</p>
                  </div>
                  <div className="space-y-1 text-sm">
                    <code className="text-xs font-semibold text-primary">speed</code>
                    <p className="text-muted-foreground text-xs">Animation speed</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Mesh Background Component Download Section */}
      <div className="mt-12 space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">Use Mesh Background in Your Project</h2>
        <p className="text-muted-foreground">
          The interactive mesh gradient shader component showcased above is now available as a standalone Shadcn UI component. Download and use it in your projects.
        </p>

        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/2">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Mesh Background Component
                </CardTitle>
                <CardDescription>
                  A fully customizable, production-ready mesh gradient background component
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Features */}
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">Features</h4>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <li className="flex gap-2 text-sm text-muted-foreground">
                  <span className="text-primary">✓</span>
                  <span>Customizable colors</span>
                </li>
                <li className="flex gap-2 text-sm text-muted-foreground">
                  <span className="text-primary">✓</span>
                  <span>Adjustable animation speed</span>
                </li>
                <li className="flex gap-2 text-sm text-muted-foreground">
                  <span className="text-primary">✓</span>
                  <span>Full-screen responsive</span>
                </li>
                <li className="flex gap-2 text-sm text-muted-foreground">
                  <span className="text-primary">✓</span>
                  <span>Dark mode support</span>
                </li>
                <li className="flex gap-2 text-sm text-muted-foreground">
                  <span className="text-primary">✓</span>
                  <span>TypeScript types</span>
                </li>
                <li className="flex gap-2 text-sm text-muted-foreground">
                  <span className="text-primary">✓</span>
                  <span>GPU-accelerated WebGL</span>
                </li>
              </ul>
            </div>

            {/* Installation */}
            <div className="space-y-3 pt-4 border-t border-border/50">
              <h4 className="text-sm font-semibold text-foreground">Installation</h4>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-2">1. Copy component file to your project:</p>
                  <CodeBlock
                    code="cp components/ui/mesh-background.tsx your-project/components/ui/"
                    showIcon={true}
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">2. Install dependency:</p>
                  <CodeBlock
                    code="npm install @paper-design/shaders-react"
                    showIcon={true}
                  />
                </div>
              </div>
            </div>

            {/* Usage */}
            <div className="space-y-3 pt-4 border-t border-border/50">
              <h4 className="text-sm font-semibold text-foreground">Basic Usage</h4>
              <div className="bg-muted/30 rounded-lg p-4 font-mono text-sm overflow-x-auto border border-border/50">
                <pre className="text-foreground/80 whitespace-pre-wrap break-words leading-6">
                  {`import { MeshBackground } from "@/components/ui/mesh-background"

export default function Hero() {
  return (
    <MeshBackground className="min-h-screen">
      <div className="flex items-center justify-center min-h-screen">
        <h1 className="text-4xl font-bold text-white">
          Welcome
        </h1>
      </div>
    </MeshBackground>
  )
}`}
                </pre>
              </div>
            </div>

            {/* Props */}
            <div className="space-y-3 pt-4 border-t border-border/50">
              <h4 className="text-sm font-semibold text-foreground">Key Props</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="space-y-1">
                  <code className="text-xs font-semibold text-primary">colors</code>
                  <p className="text-muted-foreground text-xs">Customize gradient colors (hex/hsl)</p>
                </div>
                <div className="space-y-1">
                  <code className="text-xs font-semibold text-primary">distortion</code>
                  <p className="text-muted-foreground text-xs">Animation distortion (0-2)</p>
                </div>
                <div className="space-y-1">
                  <code className="text-xs font-semibold text-primary">speed</code>
                  <p className="text-muted-foreground text-xs">Animation speed (0-1)</p>
                </div>
                <div className="space-y-1">
                  <code className="text-xs font-semibold text-primary">swirl</code>
                  <p className="text-muted-foreground text-xs">Rotation effect (0-1)</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 flex flex-col sm:flex-row gap-3">
              <Button asChild className="flex-1">
                <a href="https://github.com/moazamtech/shadway/blob/main/components/ui/mesh-background.tsx" target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4 mr-2" />
                  Download Component
                </a>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <a href="/docs/shaders#mesh-background" target="_blank">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Full Docs
                </a>
              </Button>
            </div>

            {/* Info Box */}
            <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
              <p className="text-xs text-muted-foreground">
                <strong>Dependencies:</strong> @paper-design/shaders-react, React 18+, Tailwind CSS 3+
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
