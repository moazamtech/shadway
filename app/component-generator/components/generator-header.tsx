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
    <header className={cn("z-50 top-0 w-full border-b border-border", className)}>
      <div className="flex h-14 items-center justify-between px-4 md:px-6 lg:px-8 w-full mx-auto">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/logo.png"
            alt="Shadway"
            width={22}
            height={22}
            priority
          />
          <span className="font-serif text-lg tracking-tight">Shadway</span>
          <span className="hidden sm:inline-flex h-5 items-center border border-border bg-muted/20 px-2 text-[9px] font-mono font-semibold uppercase tracking-[0.15em] text-muted-foreground/60">
            Architect
          </span>
        </Link>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-8 w-8 md:w-auto md:px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Zap className="h-3.5 w-3.5 md:mr-1.5" />
            <span className="hidden md:inline">New</span>
          </Button>
          <div className="h-4 w-px bg-border" />
          <ThemeToggle />

          {hasGenerated && (
            <>
              <div className="h-4 w-px bg-border" />
              <Button
                variant={isPanelOpen ? "default" : "ghost"}
                size="sm"
                onClick={onTogglePanel}
                className={cn(
                  "h-8 w-8 md:w-auto md:px-3 text-[10px] font-semibold uppercase tracking-[0.15em] transition-colors",
                  isPanelOpen
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {isPanelOpen ? (
                  <>
                    <XIcon className="h-3.5 w-3.5 md:mr-1.5" />
                    <span className="hidden md:inline">Close</span>
                  </>
                ) : (
                  <>
                    <Code2Icon className="h-3.5 w-3.5 md:mr-1.5" />
                    <span className="hidden md:inline">Preview</span>
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
