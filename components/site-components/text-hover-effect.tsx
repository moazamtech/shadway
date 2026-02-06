"use client"
import React, { useRef, useState, useEffect, useId } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { useTheme } from "next-themes"

export const TextHoverEffect = ({
  text,
  duration,
  fontSize = 56,
}: {
  text: string
  duration?: number
  fontSize?: number
}) => {
  const id = useId()
  const svgRef = useRef<SVGSVGElement>(null)
  const maskGradientRef = useRef(null)
  const animatedTextRef = useRef(null)
  const frameTopRef = useRef(null)
  const frameBotRef = useRef(null)
  const [cursor, setCursor] = useState({ x: 0, y: 0 })
  const [hovered, setHovered] = useState(false)
  const [maskPosition, setMaskPosition] = useState({ cx: "50%", cy: "50%" })
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  // Unique IDs to avoid collisions when multiple instances exist
  const gradientId = `textGradient-${id}`
  const revealMaskId = `revealMask-${id}`
  const textMaskId = `textMask-${id}`

  // Theme-aware colors
  const baseStroke = isDark ? "#ffffff" : "#0a0a0a"
  const gradientStops = isDark
    ? ["#4040aa", "#8090dd", "#303088"]
    : ["#6070cc", "#4040aa", "#5060bb"]
  const frameStroke = isDark
    ? "rgba(255,255,255,0.08)"
    : "rgba(0,0,0,0.08)"
  const nodeStroke = isDark
    ? "rgba(255,255,255,0.15)"
    : "rgba(0,0,0,0.12)"

  useGSAP(
    () => {
      // Stroke draw-in animation
      gsap.fromTo(
        animatedTextRef.current,
        { strokeDashoffset: 1000, strokeDasharray: 1000 },
        {
          strokeDashoffset: 0,
          strokeDasharray: 1000,
          duration: 4,
          ease: "power2.inOut",
        }
      )

      // Frame lines fade in
      gsap.fromTo(
        [frameTopRef.current, frameBotRef.current],
        { opacity: 0 },
        { opacity: 1, duration: 1.5, delay: 0.5, ease: "power1.out" }
      )
    },
    { scope: svgRef }
  )

  const updateCursorPosition = (x: number, y: number) => {
    if (svgRef.current && x !== null && y !== null) {
      const svgRect = svgRef.current.getBoundingClientRect()
      const cxPercentage = ((x - svgRect.left) / svgRect.width) * 100
      const cyPercentage = ((y - svgRect.top) / svgRect.height) * 100

      const newPosition = {
        cx: `${cxPercentage}%`,
        cy: `${cyPercentage}%`,
      }

      setMaskPosition(newPosition)

      gsap.to(maskGradientRef.current, {
        attr: newPosition,
        duration: duration ?? 0,
        ease: "power2.out",
      })
    }
  }

  useEffect(() => {
    updateCursorPosition(cursor.x, cursor.y)
  }, [cursor, duration])

  const handleMouseEnter = () => setHovered(true)
  const handleMouseLeave = () => setHovered(false)
  const handleMouseMove = (e: React.MouseEvent) => {
    setCursor({ x: e.clientX, y: e.clientY })
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault()
    setHovered(true)
    if (e.touches.length > 0) {
      const touch = e.touches[0]
      setCursor({ x: touch.clientX, y: touch.clientY })
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length > 0) {
      const touch = e.touches[0]
      setCursor({ x: touch.clientX, y: touch.clientY })
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault()
    setHovered(false)
  }

  // Frame geometry
  const vw = 300
  const vh = 100
  const frameY1 = 12
  const frameY2 = vh - 12
  const nodeR = 1.2

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox={`0 0 ${vw} ${vh}`}
      xmlns="http://www.w3.org/2000/svg"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      className="select-none"
    >
      <defs>
        <linearGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="0%"
        >
          {hovered && (
            <>
              <stop offset="0%" stopColor={gradientStops[0]} />
              <stop offset="50%" stopColor={gradientStops[1]} />
              <stop offset="100%" stopColor={gradientStops[2]} />
            </>
          )}
        </linearGradient>
        <radialGradient
          id={revealMaskId}
          ref={maskGradientRef}
          gradientUnits="userSpaceOnUse"
          r="30%"
          cx={maskPosition.cx}
          cy={maskPosition.cy}
        >
          <stop offset="0%" stopColor="white" />
          <stop offset="60%" stopColor="rgba(255,255,255,0.4)" />
          <stop offset="100%" stopColor="black" />
        </radialGradient>
        <mask id={textMaskId}>
          <rect x="0" y="0" width="100%" height="100%" fill={`url(#${revealMaskId})`} />
        </mask>
      </defs>
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        strokeWidth="0.2"
        fill="transparent"
        stroke={baseStroke}
        style={{
          fontSize,
          fontFamily: "var(--font-playfair), Georgia, serif",
          fontWeight: 700,
          letterSpacing: "0.05em",
          opacity: hovered ? 0.06 : 0,
          transition: "opacity 0.4s ease",
        }}
      >
        {text}
      </text>

      <text
        ref={animatedTextRef}
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        strokeWidth="0.2"
        fill="transparent"
        stroke={baseStroke}
        style={{
          fontSize,
          fontFamily: "var(--font-playfair), Georgia, serif",
          fontWeight: 700,
          letterSpacing: "0.05em",
          opacity: 0.12,
        }}
      >
        {text}
      </text>

      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        strokeWidth="0.4"
        fill="transparent"
        stroke={`url(#${gradientId})`}
        mask={`url(#${textMaskId})`}
        style={{
          fontSize,
          fontFamily: "var(--font-playfair), Georgia, serif",
          fontWeight: 700,
          letterSpacing: "0.05em",
        }}
      >
        {text}
      </text>

      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        strokeWidth="0"
        fill={`url(#${gradientId})`}
        mask={`url(#${textMaskId})`}
        style={{
          fontSize,
          fontFamily: "var(--font-playfair), Georgia, serif",
          fontWeight: 700,
          letterSpacing: "0.05em",
          opacity: hovered ? 0.08 : 0,
          transition: "opacity 0.3s ease",
        }}
      >
        {text}
      </text>
    </svg>
  )
}
