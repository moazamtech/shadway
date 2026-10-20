import { BrandMark } from "@/components/brand-mark";

/**
 * The wait between two pages.
 *
 * A page here is a server page: it asks the database, and the answer takes
 * as long as the answer takes. The browser would rather show nothing than
 * the wrong thing, so it shows nothing — and "nothing" is white, which on a
 * dark site is a flash of the wrong colour in the middle of a click.
 *
 * So the wait is painted in the site's own background, with the mark in the
 * middle of it. It is not a page and it is not a design: it is the colour
 * the page is about to be, so the eye has nothing to catch on.
 */
export default function Loading() {
  return (
    <div
      className="flex min-h-dvh items-center justify-center bg-background"
      role="status"
      aria-label="Loading"
    >
      <BrandMark size={26} glow={false} />
    </div>
  );
}
