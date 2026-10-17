import { cn } from "@/lib/utils";

/**
 * The Shadway mark.
 *
 * The logo art is a lit sphere, so it gets its own ambient light: a blurred
 * copy of the same image sits behind the crisp one and bleeds its color
 * outward. That halo is what the brand rows wear instead of the hard black
 * square the mark used to sit in — the mark lights the chrome instead of
 * being boxed on it.
 *
 * The art is served from `logo-mark.webp`, a 96px derivative of the 371x406
 * `logo.png` master: the mark is painted at 20px, so the master is roughly
 * twenty times the bytes for pixels that are never resolved. Regenerate it by
 * resizing `public/logo.png` to 96x96 and exporting WebP if the art changes.
 */
export function BrandMark({  size = 20,
  className,
  glow = true,
  label,
}: {
  /** Rendered edge length in pixels. */
  size?: number;
  className?: string;
  /** Off for spots where a glow would be clipped or read as a smudge. */
  glow?: boolean;
  /** Accessible name; omit when the mark sits next to the wordmark. */
  label?: string;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center",
        className
      )}
      style={{ width: size, height: size }}
    >
      {glow ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/logo-mark.webp"
          alt=""
          aria-hidden
          draggable={false}
          className="absolute inset-0 h-full w-full scale-150 object-contain opacity-60 blur-md dark:opacity-80"
        />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-mark.webp"
        alt={label ?? ""}
        draggable={false}
        className="relative h-full w-full object-contain"
      />
    </span>
  );
}
