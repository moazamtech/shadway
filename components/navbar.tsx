"use client";

import { useState, useEffect } from "react";
import {
  Menu,
  X,
  Github,
  ChevronDown,
  Database,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/auth/user-menu";
import Image from "next/image";
import Link from "next/link";

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [showResourcesDropdown, setShowResourcesDropdown] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navItems = [
    { name: "Home", href: "/" },
    { name: "Templates", href: "/template" },
    { name: "Submit", href: "/submit" },
  ];

  const resourceItems = [
    {
      name: "Databases",
      href: "/databases",
      icon: Database,
      description: "Next.js compatible databases",
    },
    {
      name: "Docs",
      href: "/docs",
      icon: BookOpen,
      description: "Documentation and guides",
    },
    {
      name: "Component Generator",
      href: "/component-generator",
      icon: Sparkles,
      description: "AI-powered component builder",
    },
    {
      name: "Vibecode",
      href: "/vibecode",
      icon: Sparkles,
      description: "Published AI-generated components",
    },
    {
      name: "AI CHATBOT",
      href: "/chatbot",
      icon: Sparkles,
      description: "AI-powered T3CHAT CLONE",
    },
  ];

  return (
    <>
      {/* Main Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-transparent">
        <div className="relative flex flex-col justify-start items-center w-full">
          <div className="w-full max-w-none px-4 sm:px-6 md:px-8 lg:px-8 lg:max-w-[1270px] lg:w-[1360px] relative flex flex-col justify-start items-start">
            {/* Left vertical line - only show when not scrolled */}
           
            <div
              className={`self-stretch flex flex-col items-center relative z-10 transition-all duration-500 ${isScrolled ? "py-3" : "pt-6 pb-3"}`}
            >
              {/* Desktop Navigation - Minimalist Floating Design */}
              <div className="hidden lg:flex h-14 items-center justify-center w-full">
                <div className="flex items-center justify-between w-full max-w-6xl">
                  {/* Logo */}
                  <div className="flex items-center">
                    <Link href="/">
                      <div
                        className={`flex items-center space-x-3 px-4 py-2 rounded-xl backdrop-blur-md transition-all duration-300 cursor-pointer hover:scale-105 ${
                          isScrolled
                            ? "bg-background/60 border border-border/30"
                            : "bg-background/40 border border-border/20"
                        }`}
                      >
                        <Image
                          src="/logo.png"
                          width={32}
                          height={32}
                          alt="Shadway Logo"
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold tracking-tight text-foreground leading-none">
                            Shadway
                          </span>
                        </div>
                      </div>
                    </Link>
                  </div>

                  {/* Navigation Links */}
                  <div
                    className={`flex items-center space-x-2 px-6 py-2 rounded-xl backdrop-blur-md transition-all duration-300 ${
                      isScrolled
                        ? "bg-background/60 border border-border/30"
                        : "bg-background/40 border border-border/20"
                    }`}
                  >
                    {navItems.map((item) => (
                      <Link key={item.name} href={item.href}>
                        <div className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-background/50 cursor-pointer">
                          {item.name}
                        </div>
                      </Link>
                    ))}

                    {/* Resources Dropdown - the app's own menu primitive */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="group px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-background/50 cursor-pointer inline-flex items-center gap-1.5">
                          Resources
                          <ChevronDown className="w-3.5 h-3.5 transition-transform duration-300 group-data-[state=open]:rotate-180" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="center"
                        sideOffset={8}
                        className="w-80 rounded-xl"
                      >
                        {resourceItems.map((item) => {
                          const Icon = item.icon;
                          return (
                            <DropdownMenuItem
                              key={item.name}
                              asChild
                              className="cursor-pointer items-start gap-3 px-2.5 py-2.5"
                            >
                              <Link href={item.href}>
                                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                  <Icon className="size-4 text-primary" />
                                </span>
                                <span className="flex min-w-0 flex-col gap-1">
                                  <span className="text-sm font-medium leading-none">
                                    {item.name}
                                  </span>
                                  <span className="text-xs leading-relaxed text-muted-foreground">
                                    {item.description}
                                  </span>
                                </span>
                              </Link>
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
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
                            ? "bg-background/60 border border-border/30 hover:bg-background/80"
                            : "bg-background/40 border border-border/20 hover:bg-background/60"
                        }`}
                        onClick={() =>
                          window.open(
                            "https://github.com/moazamtech/shadway",
                            "_blank",
                            "noopener,noreferrer",
                          )
                        }
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

                    {/* Auth - session aware */}
                    <div className="hover:scale-105 transition-transform">
                      <UserMenu variant="desktop" isScrolled={isScrolled} />
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
                    <div
                      className={`flex items-center space-x-2 backdrop-blur-xl rounded-xl px-3 py-2 border shadow-sm transition-all duration-500 cursor-pointer ${
                        isScrolled
                          ? "bg-background/20 border-border/10"
                          : "bg-background/40 border-border/20"
                      }`}
                    >
                      <Image
                        src="/logo.png"
                        width={42}
                        height={42}
                        alt="Shadway Logo"
                      />
                      <span className="text-sm font-semibold tracking-tight text-foreground">
                        Shadway
                      </span>
                    </div>
                  </Link>

                  {/* Mobile Actions */}
                  <div className="flex items-center space-x-2">
                    {/* Mobile GitHub */}
                    <div className="hover:scale-105 transition-transform">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-10 px-3 backdrop-blur-xl border transition-all duration-300 rounded-xl shadow-sm ${
                          isScrolled
                            ? "bg-background/20 border-border/10 hover:bg-background/40"
                            : "bg-background/40 border-border/20 hover:bg-background/60"
                        }`}
                        onClick={() =>
                          window.open(
                            "https://github.com/moazamtech/shadway",
                            "_blank",
                            "noopener,noreferrer",
                          )
                        }
                      >
                        <Github className="w-4 h-4" />
                      </Button>
                    </div>

                    <ThemeToggle />

                    {/* Auth - session aware */}
                    <div className="hover:scale-105 transition-transform">
                      <UserMenu variant="mobile" isScrolled={isScrolled} />
                    </div>

                    {/* Mobile Menu Toggle */}
                    <div className="hover:scale-105 transition-transform">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-10 w-10 backdrop-blur-xl border transition-all duration-300 rounded-xl shadow-sm ${
                          isScrolled
                            ? "bg-background/20 border-border/10 hover:bg-background/40"
                            : "bg-background/40 border-border/20 hover:bg-background/60"
                        }`}
                        onClick={() => setShowMobileNav(!showMobileNav)}
                      >
                        <div
                          className={`transition-transform duration-300 ${showMobileNav ? "rotate-180" : ""}`}
                        >
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
                <div
                  className={`w-full overflow-hidden transition-all duration-300 ${
                    showMobileNav
                      ? "opacity-100 max-h-[600px]"
                      : "opacity-0 max-h-0"
                  }`}
                >
                  <div
                    className={`flex flex-col gap-2 backdrop-blur-xl rounded-xl p-3 border shadow-sm transition-all duration-500 ${
                      isScrolled
                        ? "bg-background/20 border-border/10"
                        : "bg-background/40 border-border/20"
                    }`}
                  >
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
                        onClick={() =>
                          setShowResourcesDropdown(!showResourcesDropdown)
                        }
                        className="w-full px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-all rounded-xl hover:bg-background/60 flex items-center justify-between"
                      >
                        Resources
                        <ChevronDown
                          className={`w-3 h-3 transition-transform ${showResourcesDropdown ? "rotate-180" : ""}`}
                        />
                      </button>

                      {showResourcesDropdown && (
                        <div className="mt-2 space-y-1 pl-2">
                          {resourceItems.map((item) => {
                            const Icon = item.icon;
                            return (
                              <Link key={item.name} href={item.href}>
                                <div
                                  className="flex items-center gap-3 px-4 py-2 text-sm rounded-xl hover:bg-background/60 transition-all cursor-pointer"
                                  onClick={() => {
                                    setShowMobileNav(false);
                                    setShowResourcesDropdown(false);
                                  }}
                                >
                                  <Icon className="w-4 h-4 text-primary" />
                                  <span className="text-muted-foreground hover:text-foreground">
                                    {item.name}
                                  </span>
                                </div>
                              </Link>
                            );
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
  );
}
