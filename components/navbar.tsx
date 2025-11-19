"use client"

import { useState, useEffect } from "react"
import { Menu, X, Github, ChevronDown, Database, BookOpen, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import Image from "next/image"
import Link from "next/link"

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [showMobileNav, setShowMobileNav] = useState(false)
  const [showResourcesDropdown, setShowResourcesDropdown] = useState(false)
  const [showDesktopDropdown, setShowDesktopDropdown] = useState(false)
  const [dropdownTimeout, setDropdownTimeout] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navItems = [
    { name: "Home", href: "/" },
    { name: "Components", href: "/components" },
    { name: "Templates", href: "/template" },
    { name: "Sponsor", href: "/sponsor" },
    { name: "Submit", href: "/submit" },
  ]

  const resourceItems = [
    {
      name: "Databases",
      href: "/databases",
      icon: Database,
      description: "Next.js compatible databases"
    },
    {
      name: "Docs",
      href: "/docs",
      icon: BookOpen,
      description: "Documentation and guides"
    },
    {
      name: "Component Generator",
      href: "/component-generator",
      icon: Sparkles,
      description: "AI-powered component builder"
    },
  ]

  return (
    <>
      {/* Main Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-transparent">
        <div className="relative flex flex-col justify-start items-center w-full">
          <div className="w-full max-w-none px-4 sm:px-6 md:px-8 lg:px-12 lg:max-w-[1270px] lg:w-[1360px] relative flex flex-col justify-start items-start">
            {/* Left vertical line - only show when not scrolled */}
            <div className={`hidden sm:block w-[1px] h-full absolute left-4 sm:left-6 md:left-8 lg:left-0 top-0 bg-border/30 z-0 transition-opacity duration-500 ${isScrolled ? 'opacity-0' : 'opacity-100'}`}></div>
            {/* Right vertical line - only show when not scrolled */}
            <div className={`hidden sm:block w-[1px] h-full absolute right-4 sm:right-6 md:right-8 lg:right-0 top-0 bg-border/30 z-0 transition-opacity duration-500 ${isScrolled ? 'opacity-0' : 'opacity-100'}`}></div>

            <div className={`self-stretch flex flex-col items-center relative z-10 transition-all duration-500 ${isScrolled ? 'py-3' : 'pt-6 pb-3'}`}>
              {/* Desktop Navigation - Minimalist Floating Design */}
              <div className="hidden lg:flex items-center justify-center w-full">
                <div className="flex items-center justify-between w-full max-w-6xl">
                  {/* Logo */}
                  <div className="flex items-center">
                    <Link href="/">
                      <div className={`flex items-center space-x-3 px-4 py-2 rounded-xl backdrop-blur-md transition-all duration-300 cursor-pointer hover:scale-105 ${
                          isScrolled
                            ? 'bg-background/60 border border-border/30'
                            : 'bg-background/40 border border-border/20'
                        }`}>
                       <Image
                        src="/logo.png"
                        width={32}
                        height={32}
                        alt="Shadway Logo"
                        />
                        <div className="flex flex-col">
                          <span className="font-bold text-lg text-foreground leading-none">Shadway</span>
                        </div>
                      </div>
                    </Link>
                  </div>

                  {/* Navigation Links */}
                  <div className={`flex items-center space-x-2 px-6 py-3 rounded-xl backdrop-blur-md transition-all duration-300 ${
                      isScrolled
                        ? 'bg-background/60 border border-border/30'
                        : 'bg-background/40 border border-border/20'
                    }`}>
                    {navItems.map((item) => (
                      <Link key={item.name} href={item.href}>
                        <div className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-background/50 cursor-pointer">
                          {item.name}
                        </div>
                      </Link>
                    ))}

                    {/* Resources Dropdown - Hover Based */}
                    <div
                      className="relative group"
                      onMouseEnter={() => {
                        if (dropdownTimeout) {
                          clearTimeout(dropdownTimeout)
                          setDropdownTimeout(null)
                        }
                        const timeout = setTimeout(() => {
                          setShowDesktopDropdown(true)
                        }, 150)
                        setDropdownTimeout(timeout)
                      }}
                      onMouseLeave={() => {
                        if (dropdownTimeout) {
                          clearTimeout(dropdownTimeout)
                          setDropdownTimeout(null)
                        }
                        const timeout = setTimeout(() => {
                          setShowDesktopDropdown(false)
                        }, 200)
                        setDropdownTimeout(timeout)
                      }}
                    >
                      <button className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-background/50 cursor-pointer inline-flex items-center gap-1.5">
                        Resources
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${showDesktopDropdown ? 'rotate-180' : ''}`} />
                      </button>

                      {/* Dropdown Menu */}
                      <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-3 w-80 transition-all duration-300 ease-out ${
                        showDesktopDropdown
                          ? 'opacity-100 translate-y-0 pointer-events-auto'
                          : 'opacity-0 -translate-y-2 pointer-events-none'
                      }`}>
                        <div className="p-3 rounded-2xl backdrop-blur-2xl bg-background/98 border border-border/60 shadow-xl ring-1 ring-black/5">
                          <div className="space-y-1">
                            {resourceItems.map((item, index) => {
                              const Icon = item.icon
                              return (
                                <Link key={item.name} href={item.href}>
                                  <div className="group/item flex items-start gap-3 p-3.5 rounded-xl hover:bg-accent/50 transition-all duration-200 cursor-pointer hover:shadow-sm">
                                    <div className="p-2.5 rounded-xl bg-primary/10 shrink-0 group-hover/item:bg-primary/20 transition-colors">
                                      <Icon className="w-4.5 h-4.5 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0 pt-0.5">
                                      <div className="font-semibold text-sm text-foreground group-hover/item:text-primary transition-colors">{item.name}</div>
                                      <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.description}</div>
                                    </div>
                                  </div>
                                </Link>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-3">
                    {/* GitHub Button */}
                    <div className="hover:scale-105 transition-transform">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-10 px-4 rounded-xl backdrop-blur-md transition-all duration-300 group ${
                          isScrolled
                            ? 'bg-background/60 border border-border/30 hover:bg-background/80'
                            : 'bg-background/40 border border-border/20 hover:bg-background/60'
                        }`}
                        onClick={() => window.open("https://github.com/moazamtech/shadway", "_blank", "noopener,noreferrer")}
                      >
                        <Github className="w-4 h-4 mr-2 text-muted-foreground group-hover:text-foreground transition-colors" />
                        <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                          Give star
                        </span>
                      </Button>
                    </div>

                    {/* Theme Toggle */}
                    <div className="hover:scale-105 transition-transform">
                      <ThemeToggle />
                    </div>
                  </div>
                </div>
              </div>

              {/* Mobile Navigation - Unique inline design */}
              <div className="lg:hidden flex flex-col items-center w-full space-y-3">
                {/* Mobile Header */}
                <div className="flex items-center justify-between w-full px-2">
                  {/* Mobile Logo */}
                  <Link href="/">
                    <div className={`flex items-center space-x-2 backdrop-blur-xl rounded-2xl px-3 py-2 border shadow-lg transition-all duration-500 cursor-pointer ${
                        isScrolled
                          ? 'bg-background/20 border-border/10'
                          : 'bg-background/40 border-border/20'
                      }`}>
                       <Image
                        src="/logo.png"
                        width={42}
                        height={42}
                        alt="Shadway Logo"
                        />
                      <span className="font-bold text-base text-foreground">Shadway</span>
                    </div>
                  </Link>

                  {/* Mobile Actions */}
                  <div className="flex items-center space-x-2">
                    {/* Mobile GitHub */}
                    <div className="hover:scale-105 transition-transform">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-10 px-3 backdrop-blur-xl border transition-all duration-300 rounded-2xl shadow-lg ${
                          isScrolled
                            ? 'bg-background/20 border-border/10 hover:bg-background/40'
                            : 'bg-background/40 border-border/20 hover:bg-background/60'
                        }`}
                        onClick={() => window.open("https://github.com/moazamtech/shadway", "_blank", "noopener,noreferrer")}
                      >
                        <Github className="w-4 h-4" />
                      </Button>
                    </div>

                    <ThemeToggle />

                    {/* Mobile Menu Toggle */}
                    <div className="hover:scale-105 transition-transform">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-10 w-10 backdrop-blur-xl border transition-all duration-300 rounded-2xl shadow-lg ${
                          isScrolled
                            ? 'bg-background/20 border-border/10 hover:bg-background/40'
                            : 'bg-background/40 border-border/20 hover:bg-background/60'
                        }`}
                        onClick={() => setShowMobileNav(!showMobileNav)}
                      >
                        <div className={`transition-transform duration-300 ${showMobileNav ? 'rotate-180' : ''}`}>
                          {showMobileNav ? (
                            <X className="w-4 h-4" />
                          ) : (
                            <Menu className="w-4 h-4" />
                          )}
                        </div>
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Mobile Navigation Links */}
                <div className={`w-full overflow-hidden transition-all duration-300 ${
                    showMobileNav ? 'opacity-100 max-h-[600px]' : 'opacity-0 max-h-0'
                  }`}>
                  <div className={`flex flex-col gap-2 backdrop-blur-xl rounded-2xl p-3 border shadow-lg transition-all duration-500 ${
                    isScrolled
                      ? 'bg-background/20 border-border/10'
                      : 'bg-background/40 border-border/20'
                  }`}>
                    {navItems.map((item) => (
                      <Link key={item.name} href={item.href}>
                        <div
                          className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-all rounded-xl hover:bg-background/60 relative cursor-pointer hover:scale-105"
                          onClick={() => setShowMobileNav(false)}
                        >
                          {item.name}
                        </div>
                      </Link>
                    ))}

                    {/* Mobile Resources Section */}
                    <div className="border-t border-border/20 mt-2 pt-2">
                      <button
                        onClick={() => setShowResourcesDropdown(!showResourcesDropdown)}
                        className="w-full px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-all rounded-xl hover:bg-background/60 flex items-center justify-between"
                      >
                        Resources
                        <ChevronDown className={`w-3 h-3 transition-transform ${showResourcesDropdown ? 'rotate-180' : ''}`} />
                      </button>

                      {showResourcesDropdown && (
                        <div className="mt-2 space-y-1 pl-2">
                          {resourceItems.map((item) => {
                            const Icon = item.icon
                            return (
                              <Link key={item.name} href={item.href}>
                                <div
                                  className="flex items-center gap-3 px-4 py-2 text-sm rounded-xl hover:bg-background/60 transition-all cursor-pointer"
                                  onClick={() => {
                                    setShowMobileNav(false)
                                    setShowResourcesDropdown(false)
                                  }}
                                >
                                  <Icon className="w-4 h-4 text-primary" />
                                  <span className="text-muted-foreground hover:text-foreground">{item.name}</span>
                                </div>
                              </Link>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </>
  )
}