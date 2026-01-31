"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Code2Icon,
  Maximize2Icon,
  Minimize2Icon,
  XIcon,
  Zap,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import Image from "next/image";
import Link from "next/link";

export function GeneratorHeader({
  hasGenerated,
  isPanelOpen,
  onTogglePanel,
  onReset,
  className,
}: {
  hasGenerated: boolean;
  isPanelOpen: boolean;
  onTogglePanel: () => void;
  onReset: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onResetSplit: () => void;
  className?: string;
}) {
  return (
    <header className={cn("z-50 top-0 w-full", className)}>
      <div className="flex h-16 items-center justify-between px-4 md:px-8 lg:px-10 w-full mx-auto">
        <div className="flex items-center gap-3">
          <Link href="/">
            <div className="relative flex h-9 w-9 overflow-hidden rounded-lg border border-border/60 bg-background/80 p-1 transition-transform hover:scale-105">
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
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-foreground">
                SHADWAY
              </h1>
              <span className="hidden sm:inline-flex h-5 items-center rounded-md border border-border/60 bg-muted/20 px-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/70">
                v2
              </span>
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/60">
              Architect
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border/60 bg-muted/20">
            <Button
              variant="outline"
              size="sm"
              onClick={onReset}
              className="h-9 w-9 md:w-auto md:px-3 rounded-lg text-[10px] font-semibold uppercase tracking-[0.2em] border-border/60 hover:border-primary/40 hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-all"
            >
              <Zap className="h-3.5 w-3.5 md:mr-2" />
              <span className="hidden md:inline">New Chat</span>
            </Button>
            <ThemeToggle />
          </div>

          {hasGenerated && (
            <div className="flex items-center">
              <Button
                variant={isPanelOpen ? "default" : "outline"}
                size="sm"
                onClick={onTogglePanel}
                className={cn(
                  "h-9 w-9 md:w-auto md:px-4 rounded-lg text-[11px] font-semibold uppercase tracking-[0.2em] transition-all duration-200",
                  isPanelOpen
                    ? "bg-primary text-primary-foreground"
                    : "border-border/60 hover:border-primary/40 hover:bg-muted/40 text-muted-foreground hover:text-foreground",
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
    </header>
  );
}
