"use client"

import Link from "next/link"
import { Menu, X } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { useState } from "react"
import { usePathname } from "next/navigation"


function DocsNavigation() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/40 backdrop-blur-xl border-b border-border/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/docs" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <Image src="/logo.png" alt="Shadway Logo" width={24} height={24} className="h-6 w-6" />
          <span className="font-bold text-sm hidden sm:inline">Shadway Docs</span>
        </Link>

        {/* Right Actions */}
        <div className="flex items-center gap-3 ml-auto">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 h-9 px-3 text-muted-foreground hover:text-foreground hover:bg-muted/50 hidden sm:flex"
            onClick={() => window.open("https://github.com/moazamtech/shadway", "_blank")}
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
          </Button>
          <ThemeToggle />

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden h-9 w-9 rounded-lg hover:bg-muted transition-colors flex items-center justify-center"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </nav>
  )
}

function DocsDecorations() {
  return (
    <>
      {/* Background SVG Pattern */}
      <div className="fixed inset-0 pointer-events-none">

        {/* Left vertical line */}
        <div className="fixed left-4 sm:left-6 md:left-8 lg:left-12 top-0 w-[1px] h-full bg-border z-10">
          <div className="absolute top-32 left-[-2px] w-1 h-1 bg-primary rounded-full opacity-60"></div>
          <div className="absolute top-64 left-[-2px] w-1 h-1 bg-primary rounded-full opacity-60"></div>
          <div className="absolute top-96 left-[-2px] w-1 h-1 bg-primary rounded-full opacity-60"></div>
        </div>

        {/* Right vertical line */}
        <div className="fixed right-4 sm:right-6 md:right-8 lg:right-12 top-0 w-[1px] h-full bg-border z-10">
          <div className="absolute top-32 right-[-2px] w-1 h-1 bg-primary rounded-full opacity-60"></div>
          <div className="absolute top-64 right-[-2px] w-1 h-1 bg-primary rounded-full opacity-60"></div>
          <div className="absolute top-96 right-[-2px] w-1 h-1 bg-primary rounded-full opacity-60"></div>
        </div>

        {/* Left decorative dashed border - XL screens only */}
        <div className="fixed left-[-60px] top-0 w-[60px] h-full border border-dashed dark:border-[#eee] border-[#000]/70 dark:opacity-[0.15] opacity-[0.2] hidden xl:block pointer-events-none"
          style={{
            backgroundImage: "repeating-linear-gradient(-45deg, transparent, transparent 2px, currentcolor 2px, currentcolor 3px, transparent 3px, transparent 6px)",
          }}
        ></div>

        {/* Right decorative dashed border - XL screens only */}
        <div className="fixed right-[-60px] top-0 w-[60px] h-full border border-dashed dark:border-[#eee] border-[#000]/70 dark:opacity-[0.15] opacity-[0.2] hidden xl:block pointer-events-none"
          style={{
            backgroundImage: "repeating-linear-gradient(-45deg, transparent, transparent 2px, currentcolor 2px, currentcolor 3px, transparent 3px, transparent 6px)",
          }}
        ></div>
      </div>
    </>
  )
}

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* Decorative Elements */}
      <DocsDecorations />
      <DocsNavigation />
      {/* Main Content */}
      <main className="relative ">
        {children}
      </main>
    </div>
  )
}
