import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The framed box.
 *
 * A surface inside a surface: a muted slab with a hair of breathing room
 * around it, and the real panel inside that. The two layers are what make a
 * card read as an object on a table rather than as a rectangle of colour, and
 * the same frame is what the feed's cards, the studio's panes and the
 * dialogs are all built from — so a page made of them reads as one page.
 *
 * The panel carries its own hairline and a shadow that sits *under* it, which
 * is what gives the frame depth without a second border doing the work.
 */
export function Frame({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      data-slot="frame"
      className={cn(
        "relative flex flex-col rounded-2xl bg-muted/72 p-1",
        "*:[[data-slot=frame-panel]+[data-slot=frame-panel]]:mt-1",
        className
      )}
      {...props}
    />
  );
}

/**
 * The panel inside a frame.
 *
 * The shadow is drawn by a pseudo-element rather than by the box, so the
 * hairline stays exactly one pixel and the highlight — a light line along the
 * top in the dark theme, a dark one in the light — reads as the edge of the
 * panel catching the light rather than as a border that is a shade off.
 */
export function FramePanel({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      data-slot="frame-panel"
      className={cn(
        "relative rounded-xl border bg-background bg-clip-padding shadow-xs/5 before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-xl)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
        className
      )}
      {...props}
    />
  );
}

/** The header of a framed panel. */
export function FrameHeader({
  className,
  ...props
}: React.ComponentProps<"header">): React.ReactElement {
  return (
    <header
      data-slot="frame-panel-header"
      className={cn("flex flex-col px-5 py-4", className)}
      {...props}
    />
  );
}

/** The title of a framed panel. */
export function FrameTitle({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      data-slot="frame-panel-title"
      className={cn("font-semibold text-sm", className)}
      {...props}
    />
  );
}

/** The description of a framed panel. */
export function FrameDescription({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      data-slot="frame-panel-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

/** The footer of a framed panel. */
export function FrameFooter({
  className,
  ...props
}: React.ComponentProps<"footer">): React.ReactElement {
  return (
    <footer
      data-slot="frame-panel-footer"
      className={cn("px-5 py-4", className)}
      {...props}
    />
  );
}
