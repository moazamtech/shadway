"use client"

import * as React from "react"
import { Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "next-themes"
import { motion } from "framer-motion"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Ensure component is mounted before applying animations
  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Prevent hydration mismatch by not rendering theme-dependent content on server
  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-11 w-11 rounded-2xl bg-background/40 backdrop-blur-xl border border-border/20 hover:bg-background/60 hover:border-border/40 transition-all duration-300 relative overflow-hidden group shadow-lg"
        disabled
      >
        <Sun className="h-5 w-5 text-amber-500" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-11 w-11 rounded-2xl bg-background/40 backdrop-blur-xl border border-border/20 hover:bg-background/60 hover:border-border/40 transition-all duration-300 relative overflow-hidden group shadow-lg"
        >
          <motion.div
            initial={false}
            animate={mounted ? { rotate: theme === "dark" ? 180 : 0 } : { rotate: 0 }}
            transition={{ duration: mounted ? 0.3 : 0, ease: "easeInOut" }}
            className="relative"
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-amber-500" />
            <Moon className="absolute top-0 left-0 h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-blue-400" />
          </motion.div>

          {/* Decorative elements */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="absolute top-1 right-1 w-1 h-1 bg-primary/60 rounded-full"></div>
            <div className="absolute bottom-1 left-1 w-1 h-1 bg-primary/40 rounded-full"></div>
          </div>

          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[140px] bg-background/80 backdrop-blur-xl border-border/30 shadow-xl rounded-2xl p-2"
      >
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
        >
          <Sun className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-medium">Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
        >
          <Moon className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-medium">Dark</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("system")}
          className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
        >
          <Monitor className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">System</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}