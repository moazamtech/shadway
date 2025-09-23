"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { motion } from "framer-motion"

import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Ensure component is mounted before applying animations
  React.useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }

  // Prevent hydration mismatch by not rendering theme-dependent content on server
  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-10 w-10 rounded-xl bg-background/40 backdrop-blur-md border border-border/20 hover:bg-background/60 transition-all duration-200"
        disabled
      >
        <Sun className="h-4 w-4" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className="h-10 w-10 rounded-xl bg-background/40 backdrop-blur-md border border-border/20 hover:bg-background/60 transition-all duration-200 relative overflow-hidden"
    >
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        animate={{ rotate: resolvedTheme === "dark" ? 360 : 0 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        <Sun className="h-4 w-4 text-amber-500 absolute scale-100 dark:scale-0 transition-transform duration-200" />
        <Moon className="h-4 w-4 text-blue-400 absolute scale-0 dark:scale-100 transition-transform duration-200" />
      </motion.div>
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}