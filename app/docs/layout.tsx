"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BookOpen, Package, Code, Palette, Layers, FileText, Settings } from "lucide-react"
import Image from "next/image"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from "@/components/ui/breadcrumb"

const docsConfig = {
  sidebarNav: [
    {
      title: "Getting Started",
      items: [
        {
          title: "Introduction",
          href: "/docs",
          icon: BookOpen,
        },
        {
          title: "Installation",
          href: "/docs/installation",
          icon: Package,
        },
      ],
    },
    {
      title: "Components",
      items: [
        {
          title: "Overview",
          href: "/docs/components",
          icon: Layers,
        },
        {
          title: "Shaders & Effects",
          href: "/docs/shaders",
          icon: Code,
        },
        {
          title: "Heros & Layouts",
          href: "/docs/resources",
          icon: FileText,
        },
      ],
    },
    {
      title: "Customization",
      items: [
        {
          title: "Theming",
          href: "/docs/theming",
          icon: Palette,
        },
        {
          title: "Examples",
          href: "/docs/examples",
          icon: Settings,
        },
      ],
    },
  ],
}

function DocsSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar className="bg-background border-r border-border/50">
      {/* Header with Logo */}
      <SidebarHeader className="border-b border-border/50 p-6 space-y-4">
        <Link href="/docs" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="flex w-10 items-center justify-center">
            <Image
              src="/logo.png"
              alt="Shadway Logo"
              width={24}
              height={24}
              className="h-6 w-6"
            />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm leading-none">Shadway UI</span>
            <span className="text-xs text-muted-foreground leading-none">Docs</span>
          </div>
        </Link>
      </SidebarHeader>

      {/* Navigation Content */}
      <SidebarContent className="px-3 py-6 space-y-6">
        {docsConfig.sidebarNav.map((section, index) => (
          <SidebarGroup key={section.title} className="space-y-3">
            <SidebarGroupLabel className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              {section.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild>
                        <Link
                          href={item.href}
                          className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                            isActive
                              ? "bg-muted text-foreground"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t border-border/50 p-4">
        <div className="flex flex-col gap-3">
          <div className="text-xs text-muted-foreground leading-relaxed">
            <p className="font-medium mb-1">Shadway Documentation</p>
            {/* <p>Explore, learn, and build amazing UIs with Shadcn.</p> */}
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <SidebarProvider defaultOpen={true}>
        <div className="flex w-full transition-all duration-300 ease-out">
          {/* Sidebar with smooth transition */}
          <div className="transition-all duration-300 ease-out">
            <DocsSidebar />
          </div>

          <SidebarInset className="flex-1">
            {/* Header - Connected with sidebar */}
            <header className="sticky top-0 z-40 flex h-[75px] shrink-0 items-center justify-between border-b border-border/30 bg-background/80 backdrop-blur-xl transition-all duration-300 ease-out">
              {/* Left Section - Menu & Breadcrumb */}
              <div className="flex items-center gap-0 flex-1 min-w-0">
                <SidebarTrigger
                  className="mr-0 h-10 w-10 hover:bg-muted rounded-lg transition-colors"
                />
                <div className="hidden sm:flex items-center ml-2">
                  <div className="h-5 w-px bg-border/30 mx-1" />
                  <Breadcrumb>
                    <BreadcrumbList>
                      <BreadcrumbItem>
                        <BreadcrumbLink
                          href="/docs"
                          className="text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Documentation
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                    </BreadcrumbList>
                  </Breadcrumb>
                </div>
              </div>

              {/* Right Section - Actions */}
              <div className="flex items-center gap-2 ml-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 h-9 px-3 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-all duration-200"
                  onClick={() => window.open("https://github.com/moazamtech/shadway", "_blank", "noopener,noreferrer")}
                >
                  <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  <span className="hidden sm:inline text-sm font-medium">GitHub</span>
                </Button>
                <div className="h-6 w-px bg-border/30 mx-1 hidden sm:block" />
                <ThemeToggle />
              </div>
            </header>

            {/* Main Content - Smooth scroll */}
            <div className="flex-1 transition-all duration-300 ease-out">
              <div className="animate-in fade-in duration-300">
                {children}
              </div>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-in {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
