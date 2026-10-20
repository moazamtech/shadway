"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { SidebarRail } from "@/components/marketplace/sidebar-rail";
import { CommandPalette } from "@/components/marketplace/command-palette";
import { PaletteProvider } from "@/components/marketplace/palette-context";
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
 *
 * The palette lives here rather than on the feed, because ⌘K is a shortcut
 * and a shortcut that only works on one page is a shortcut most people never
 * learn. It is mounted once, for every page, and it opens what it is sent
 * to.
 */
export function AppShell({
  toolbar,
  children,
  activeCategory,
  activeTag,
  nav,
  contentClassName,
  panelClassName,
}: {
  /** Right-aligned page controls; the menu button is prepended on phones. */
  toolbar?: React.ReactNode;
  /** The page body. It scrolls. */
  children: React.ReactNode;
  /** Marks a category group as current in the rail's catalog. */
  activeCategory?: string;
  /** Marks a sub-category as current in the rail's catalog. */
  activeTag?: string;
  /**
   * The rail's places, when they are not the marketplace's.
   *
   * The admin is a different set of places in the same column, and giving it
   * the same column — the same width, the same rows, the same account menu at
   * the foot — is what makes the admin part of this product rather than a
   * second one wearing a different skin.
   */
  nav?: { title: string; href: string; icon: React.ComponentType<{ className?: string }> }[];
  /** Applied to the scroll container inside the panel. */
  contentClassName?: string;
  /** Escape hatch for pages that manage their own panel padding. */
  panelClassName?: string;
}) {
  const [navOpen, setNavOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const scrollRef = React.useRef<HTMLDivElement>(null);

  /**
   * A new page starts at its top.
   *
   * The panel owns the scrollbar, and a scroll container keeps its offset
   * when its contents change — so reading to the bottom of the feed and
   * opening a component left the next page halfway down, with its header
   * already scrolled away. The browser's own restoration does not apply to
   * a container it does not own.
   */
  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  /**
   * ⌘K / Ctrl+K opens the palette, from anywhere.
   *
   * The rail has no search row any more: a shortcut that is always there
   * does not need a button, and the button was taking the top of the column.
   */
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="app-frame flex h-dvh w-full flex-col bg-background md:flex-row">
      <PaletteProvider
        value={{
          open: () => setPaletteOpen(true),
          close: () => setPaletteOpen(false),
        }}
      >
        <SidebarRail
          className="hidden md:flex"
          activeCategory={activeCategory}
          activeTag={activeTag}
          nav={nav}
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
            onNavigate={() => setNavOpen(false)}
            activeCategory={activeCategory}
            activeTag={activeTag}
            nav={nav}
          />
        </SheetContent>
      </Sheet>

      <main
        className={cn(
          "raised relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface md:mx-2 md:my-2 md:rounded-lg md:border md:border-border",
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
        <div
          ref={scrollRef}
          className={cn(
            "min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            contentClassName,
          )}
        >
          {children}
        </div>
      </main>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelect={(slug) => {
          setPaletteOpen(false);
          router.push(`/c/${slug}`);
        }}
      />
      </PaletteProvider>
    </div>
  );
}
