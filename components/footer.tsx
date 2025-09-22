"use client"

import { Layers } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

export function Footer() {
  return (
    <footer className="relative bg-background overflow-x-hidden">
      {/* Footer background pattern */}
      <div className="absolute inset-0 opacity-5">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="footer-pattern" width="80" height="80" patternUnits="userSpaceOnUse">
              <rect width="80" height="80" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.3"/>
              <path d="M0,40 L40,0 M40,80 L80,40" stroke="hsl(var(--border))" strokeWidth="0.3" opacity="0.2"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#footer-pattern)" />
        </svg>
      </div>

      <div className="relative flex flex-col justify-start items-center w-full">
        <div className="w-full max-w-none px-4 sm:px-6 md:px-8 lg:px-12 lg:max-w-[1270px] lg:w-[1360px] relative flex flex-col justify-start items-start">
          {/* Enhanced Left vertical line */}
          <div className="w-[1px] h-full absolute left-4 sm:left-6 md:left-8 lg:left-0 top-0 bg-border z-0">
            <div className="absolute top-16 left-[-2px] w-1 h-1 bg-primary rounded-full opacity-60"></div>
            <div className="absolute bottom-16 left-[-2px] w-1 h-1 bg-primary rounded-full opacity-60"></div>
          </div>
          {/* Enhanced Right vertical line */}
          <div className="w-[1px] h-full absolute right-4 sm:right-6 md:right-8 lg:right-0 top-0 bg-border z-0">
            <div className="absolute top-16 right-[-2px] w-1 h-1 bg-primary rounded-full opacity-60"></div>
            <div className="absolute bottom-16 right-[-2px] w-1 h-1 bg-primary rounded-full opacity-60"></div>
          </div>

          {/* Left decorative dashed border - outside of main lines */}
          <div
            className="absolute dark:opacity-[0.15] opacity-[0.2] left-[-60px] top-0 w-[60px] h-full border border-dashed dark:border-[#eee] border-[#000]/70 hidden xl:block"
            style={{
              backgroundImage:
                "repeating-linear-gradient(-45deg, transparent, transparent 2px, currentcolor 2px, currentcolor 3px, transparent 3px, transparent 6px)",
            }}
          ></div>

          {/* Right decorative dashed border - outside of main lines */}
          <div
            className="absolute dark:opacity-[0.15] opacity-[0.2] right-[-60px] top-0 w-[60px] h-full border border-dashed dark:border-[#eee] border-[#000]/70 hidden xl:block"
            style={{
              backgroundImage:
                "repeating-linear-gradient(-45deg, transparent, transparent 2px, currentcolor 2px, currentcolor 3px, transparent 3px, transparent 6px)",
            }}
          ></div>

          <div className="self-stretch pt-[9px] overflow-hidden flex flex-col justify-center items-start relative z-10 w-full">
            <div className="py-16 sm:py-20 md:py-24 px-2 sm:px-4 md:px-8 lg:px-12 w-full">
              {/* Top separator line */}
              <div className="w-full border-t border-dashed border-border/60 mb-16"></div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-12 lg:gap-16">
                <div className="md:col-span-2">
                  <div className="flex items-center space-x-3 mb-6">
                     <Image
                                      src="/logo.png"
                                      width={32}
                                      height={32}
                                      alt="Shadway Logo"
                                      />  
                    <span className="font-bold text-2xl text-foreground">Shadway</span>
                  </div>
                  <p className="text-muted-foreground max-w-md leading-relaxed text-base">
                    The ultimate collection of Shadcn UI websites and components.
                    Discover, explore, and get inspired by beautiful interfaces.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-6 text-lg text-foreground">Resources</h3>
                  <div className="space-y-4">
                    <button onClick={() => window.open("https://ui.shadcn.com", "_blank", "noopener,noreferrer")} className="block text-muted-foreground hover:text-foreground transition-colors text-sm cursor-pointer bg-transparent border-none p-0 text-left">Documentation</button>
                    <button onClick={() => window.open("https://ui.shadcn.com/docs/components", "_blank", "noopener,noreferrer")} className="block text-muted-foreground hover:text-foreground transition-colors text-sm cursor-pointer bg-transparent border-none p-0 text-left">Components</button>
                    <button onClick={() => window.open("https://ui.shadcn.com/themes", "_blank", "noopener,noreferrer")} className="block text-muted-foreground hover:text-foreground transition-colors text-sm cursor-pointer bg-transparent border-none p-0 text-left">Themes</button>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-6 text-lg text-foreground">Community</h3>
                  <div className="space-y-4">
                    <button onClick={() => window.open("https://github.com/shadcn-ui/ui", "_blank", "noopener,noreferrer")} className="block text-muted-foreground hover:text-foreground transition-colors text-sm cursor-pointer bg-transparent border-none p-0 text-left">GitHub</button>
                    <button onClick={() => window.open("https://twitter.com/shadcn", "_blank", "noopener,noreferrer")} className="block text-muted-foreground hover:text-foreground transition-colors text-sm cursor-pointer bg-transparent border-none p-0 text-left">Twitter</button>
                    <button onClick={() => window.open("https://github.com/shadcn-ui/ui/discussions", "_blank", "noopener,noreferrer")} className="block text-muted-foreground hover:text-foreground transition-colors text-sm cursor-pointer bg-transparent border-none p-0 text-left">Discussions</button>
                  </div>
                </div>
              </div>

              {/* Bottom separator line */}
              <div className="w-full border-t border-dashed border-border/60 mt-16 pt-8">
                <div className="text-center">
                  <p className="text-muted-foreground text-sm">
                    Built with ❤️ using Shadcn components.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}