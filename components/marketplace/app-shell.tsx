"use client";

import * as React from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { SidebarRail } from "@/components/marketplace/sidebar-rail";
import { cn } from "@/lib/utils";

/**
 * The marketplace shell.
 *
 * One arrangement for every page: the rail sits on the tinted canvas, the
 * page lives in a raised surface panel beside it. Phones get the same rail in
 * a drawer — the panel keeps full width.
 *
 * The panel's first row is fixed chrome (an optional toolbar passed in, a
 * menu button on phones); everything under it is the page's own scroll
 * container, so the shell owns the only scrollbar the app shows.
 */
export function AppShell({
  toolbar,
  children,
  onSearch,
  activeCategory,
  contentClassName,
  panelClassName,
}: {
  /** Right-aligned page controls; the menu button is prepended on phones. */
  toolbar?: React.ReactNode;
  /** The page body. It scrolls. */
  children: React.ReactNode;
  /** ⌘K palette trigger for the rail's search row. */
  onSearch?: () => void;
  /** Marks a category group as current in the rail's catalog. */
  activeCategory?: string;
  /** Applied to the scroll container inside the panel. */
  contentClassName?: string;
  /** Escape hatch for pages that manage their own panel padding. */
  panelClassName?: string;
}) {
  const [navOpen, setNavOpen] = React.useState(false);

  return (
    <div className="app-frame flex h-dvh w-full flex-col bg-background md:flex-row">
      <SidebarRail
        className="hidden md:flex"
        onSearch={onSearch}
        activeCategory={activeCategory}
      />

      {/* Phones get the same rail in a drawer. */}
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent
          side="left"
          className="w-72 border-border bg-background p-0"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarRail
            className="flex h-full w-full"
            onSearch={() => {
              setNavOpen(false);
              onSearch?.();
            }}
            onNavigate={() => setNavOpen(false)}
            activeCategory={activeCategory}
          />
        </SheetContent>
      </Sheet>

      <main
        className={cn(
          "raised relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface md:my-2 md:mr-2 md:rounded-lg md:border md:border-border",
          panelClassName
        )}
      >
        {toolbar !== undefined ? (
          <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3 lg:px-4">
            <Button
              variant="ghost"
              size="icon-sm"
              className="shrink-0 md:hidden"
              aria-label="Open navigation"
              onClick={() => setNavOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </Button>
            {toolbar}
          </header>
        ) : null}
        <div className={cn("min-h-0 flex-1 overflow-y-auto", contentClassName)}>
          {children}
        </div>
      </main>
    </div>
  );
}
