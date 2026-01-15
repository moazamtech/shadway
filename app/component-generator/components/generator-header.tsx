"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Code2Icon, Maximize2Icon, Minimize2Icon, XIcon, Zap } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import Image from "next/image";
import Link from "next/link";

export function GeneratorHeader({
  hasGenerated,
  isPanelOpen,
  onTogglePanel,
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
        "z-50 top-0 w-full",
        className,
      )}
    >
      <div className="flex h-16 items-center justify-between px-4 md:px-8 lg:px-10 w-full mx-auto uppercase">
        <div className="flex items-center gap-4">
       <Link href="/">  
          <div className="relative flex h-10 w-10 overflow-hidden p-1 transition-transform hover:scale-105">
            <Image
              src="/logo.png"
              alt="Shadway Logo"
              fill
              className="object-contain p-1"
              priority
            />
          </div>
          </Link>
          <div className="flex flex-col">
            <h1 className="text-xl font-black font-serif tracking-tight text-foreground sm:text-2xl">
              SHADWAY
            </h1>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                Architect V2 Professional
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center px-1.5 py-1">
            <ThemeToggle />
          </div>

          {hasGenerated && (
            <div className="flex items-center gap-2 pl-3 ml-1 border-l border-border/40">
              <Button
                variant={isPanelOpen ? "default" : "outline"}
                size="sm"
                onClick={onTogglePanel}
                className={cn(
                  "h-9 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300",
                  isPanelOpen
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/30"
                    : "border-border/60 hover:border-primary/40 hover:bg-primary/5 text-muted-foreground hover:text-primary"
                )}
              >
                {isPanelOpen ? (
                  <>
                    <XIcon className="mr-2 h-3.5 w-3.5" />
                    <span className="hidden md:inline">Hide Panel</span>
                  </>
                ) : (
                  <>
                    <Code2Icon className="mr-2 h-3.5 w-3.5" />
                    <span className="hidden md:inline">Live Preview</span>
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </header >
  );
}
