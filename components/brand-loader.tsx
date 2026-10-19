import { BrandMark } from "@/components/brand-mark";
import { cn } from "@/lib/utils";

/**
 * The branded loading state.
 *
 * A page that is loading should say whose page it is. A grid of grey boxes
 * says "something is coming"; the mark, lit on a dark stage, says "Shadway is
 * putting this together" — and it does it without a spinner, which is the
 * thing that makes a wait feel long.
 *
 * The mark breathes rather than spins: the glow swells and settles on a slow
 * cycle, so the movement is the brand's own rather than a loading icon
 * borrowed from somewhere else.
 */
export function BrandLoader({
  label = "Loading",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex min-h-[60vh] w-full flex-col items-center justify-center gap-5 bg-neutral-950 text-neutral-400",
        className,
      )}
    >
      <span className="relative flex items-center justify-center">
        {/* The halo the mark already casts, breathing. */}
        <span
          aria-hidden="true"
          className="absolute inset-0 animate-ping rounded-full bg-neutral-100/10 [animation-duration:2.4s] [animation-timing-function:cubic-bezier(0.4,0,0.6,1)]"
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 animate-pulse rounded-full bg-neutral-100/20 blur-xl [animation-duration:2.4s]"
        />
        <BrandMark size={44} className="relative" />
      </span>

      <p className="text-[11px] font-medium tracking-[0.28em] uppercase">{label}</p>
    </div>
  );
}
