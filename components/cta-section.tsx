"use client"

import { Button } from "@/components/ui/button"
import { Layers } from "lucide-react"
import { StripeBgGuides } from "@/components/ui/StripeBg"

export function CTASection() {
  return (
    <section className="relative bg-background overflow-x-hidden">
      <div className="relative flex flex-col justify-start items-center w-full">
        <div className="w-full max-w-none px-4 sm:px-6 md:px-8 lg:px-12 lg:max-w-[1270px] lg:w-[1360px] relative flex flex-col justify-start items-start">
          <StripeBgGuides
            columnCount={12}
            animated={true}
            animationDuration={10}
            glowColor="#00008B"
            randomize={true}
            randomInterval={1000}
            contained={true}
          />

          {/* Enhanced Left vertical line */}
          <div className="w-[1px] h-full absolute left-4 sm:left-6 md:left-8 lg:left-0 top-0 bg-border z-0">
          </div>
          {/* Enhanced Right vertical line */}
          <div className="w-[1px] h-full absolute right-4 sm:right-6 md:right-8 lg:right-0 top-0 bg-border z-0">
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

          {/* Top connecting line */}
          <div className="absolute top-0 left-4 sm:left-6 md:left-8 lg:left-0 right-4 sm:right-6 md:right-8 lg:right-0 h-[1px] bg-border z-0"></div>

          <div className="self-stretch pt-[9px] overflow-hidden flex flex-col justify-center items-center gap-8 lg:gap-[66px] relative z-10">
            <div className="py-16 sm:py-20 md:py-24 lg:py-32 flex flex-col justify-start items-center px-2 sm:px-4 md:px-8 lg:px-12 w-full">
              <div className="w-full max-w-[800px] text-center space-y-8">
                <h2 className="text-[32px] sm:text-[42px] md:text-[48px] lg:text-[56px] font-normal leading-[1.1] font-serif text-foreground">
                  Start Building Today
                </h2>
                <p className="text-lg md:text-xl text-muted-foreground max-w-[600px] mx-auto leading-relaxed font-medium">
                  Get inspired by these beautiful websites and start building your own amazing interfaces with Shadcn UI.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center mt-12">
                  <Button
                    size="lg"
                    className="h-12 px-8 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shadow-sm transition-all duration-200"
                  >
                    <Layers className="w-5 h-5 mr-2" />
                    Get Started
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 px-8 border-border/50 hover:bg-background/80 rounded-full transition-all duration-200"
                    asChild
                  >
                    <a href="https://ui.shadcn.com" target="_blank" rel="noopener noreferrer">
                      View Documentation
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom connecting line */}
          <div className="absolute bottom-0 left-4 sm:left-6 md:left-8 lg:left-0 right-4 sm:right-6 md:right-8 lg:right-0 h-[1px] bg-border z-0"></div>
        </div>
      </div>
    </section>
  )
}