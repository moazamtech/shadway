import { cn } from "@/lib/utils";

/**
 * The page's edges.
 *
 * Two hairlines down the sides of the content, with a small square where a
 * divider crosses them. It is the one piece of drawing on the site that is not
 * a component, and it is on every surface for the same reason the frames are:
 * a page with a margin reads as a sheet of paper, and a page that simply
 * stops reads as a canvas that happens to end.
 *
 * The squares are what say the lines were drawn on purpose. A hairline that
 * runs the whole height of a page is a border that escaped; a hairline with a
 * mark on it is a margin.
 */
export function PageRails({
  className,
  /** Where the squares sit — the bottom edge of a header, usually. */
  markAt = 0,
}: {
  className?: string;
  /** The offset of the square, in pixels, from the top. */
  markAt?: number;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 z-30 hidden md:block",
        className
      )}
    >
      {/*
        The lines sit exactly on the content's own edge, so the rules the
        grid draws between its cells and the rules this page draws down its
        sides are the same drawing: the first cell's edge *is* the left rail,
        and a divider between two sections meets both of them.
      */}
      <span className="absolute inset-y-0 left-3 w-px bg-border/70" />
      <span className="absolute inset-y-0 right-3 w-px bg-border/70" />
      {markAt > 0 ? (
        <>
          {/*
            The marks sit beside the line rather than on it. A square centred
            on the rail is half outside the panel, and the panel clips what is
            outside — so what the reader sees is half a square, which reads as
            a smudge rather than as a mark.
          */}
          <span
            className="absolute left-3 size-2 -translate-y-1/2 rounded-[2px] border border-border bg-surface"
            style={{ top: markAt }}
          />
          <span
            className="absolute right-3 size-2 -translate-y-1/2 rounded-[2px] border border-border bg-surface"
            style={{ top: markAt }}
          />
        </>
      ) : null}
    </div>
  );
}

/**
 * A rule that runs the width of the content, with a square on each rail.
 *
 * The same mark as the page's edges, at the point where a section ends: the
 * dividers and the rails are one drawing, not two that happen to be near
 * each other.
 */
export function RailDivider({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("relative h-px w-full bg-border/60", className)}>
      {/*
        The squares sit on the divider's own ends, which are the page's rails:
        the divider starts where the left rail is and stops where the right
        one is, so a mark on each end is the mark where the two lines meet.
      */}
      <span className="absolute top-0 left-0 size-2 -translate-x-1/2 -translate-y-1/2 rounded-[2px] border border-border bg-surface" />
      <span className="absolute top-0 right-0 size-2 translate-x-1/2 -translate-y-1/2 rounded-[2px] border border-border bg-surface" />
    </div>
  );
}
