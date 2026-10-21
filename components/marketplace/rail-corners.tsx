import { cn } from "@/lib/utils";

/**
 * The marks where a row meets the page's edges.
 *
 * A hairline that crosses another hairline needs something to say the
 * crossing was meant: without it, the two lines are a coincidence of
 * borders. The mark is a small square with the line running through it —
 * the same square that sits where the header's edge crosses the page's rail,
 * drawn here at the corners of a row of cards.
 *
 * The marks belong to the row, not to the page: they scroll with it, because
 * a row of cards is a thing on the page and the page's rails are the sheet it
 * is drawn on.
 */
export function RailCorners({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 z-20", className)}>
      <span className="absolute top-0 left-0 size-2 -translate-x-1/2 -translate-y-1/2 rounded-[2px] border border-border bg-surface" />
      <span className="absolute top-0 right-0 size-2 translate-x-1/2 -translate-y-1/2 rounded-[2px] border border-border bg-surface" />
      <span className="absolute bottom-0 left-0 size-2 -translate-x-1/2 translate-y-1/2 rounded-[2px] border border-border bg-surface" />
      <span className="absolute bottom-0 right-0 size-2 translate-x-1/2 translate-y-1/2 rounded-[2px] border border-border bg-surface" />
    </div>
  );
}
