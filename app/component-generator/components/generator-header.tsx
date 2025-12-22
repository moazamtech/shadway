"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Code2Icon, Maximize2Icon, Minimize2Icon, XIcon, Zap } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export function GeneratorHeader({
  hasGenerated,
  isPanelOpen,
  onTogglePanel,
  isFullscreen,
  onToggleFullscreen,
  onResetSplit,
  className,
}: {
  hasGenerated: boolean;
  isPanelOpen: boolean;
  onTogglePanel: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onResetSplit: () => void;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "z-50 top-0",
        className,
      )}
    >
      <div className="container flex h-14 items-center gap-2 px-3 md:h-16 md:gap-4 md:px-6 lg:px-8">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Zap className="h-5 w-5 md:h-6 md:w-6 fill-current" />
          </div>
          <div>
            <h1 className="text-base font-black italic md:text-xl tracking-tighter uppercase leading-none">
              SHADWAY
            </h1>
            <p className="hidden text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest sm:block mt-0.5">
              Architect V2
            </p>
          </div>
        </div>

        <ThemeToggle />

        {hasGenerated && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleFullscreen}
              className="hidden md:flex"
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen preview"}
            >
              {isFullscreen ? (
                <Minimize2Icon className="h-4 w-4" />
              ) : (
                <Maximize2Icon className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant={isPanelOpen ? "default" : "outline"}
              size="sm"
              onClick={onTogglePanel}
              className="text-xs md:text-sm"
            >
              {isPanelOpen ? (
                <>
                  <XIcon className="mr-0 h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">Hide Preview</span>
                </>
              ) : (
                <>
                  <Code2Icon className="mr-0 h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">Show Preview</span>
                </>
              )}
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
