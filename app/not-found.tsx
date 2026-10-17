import Link from "next/link";
import { Home, LayoutGrid } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { FinderProbe } from "@/components/figures/finder/finder";
import { Button } from "@/components/ui/button";

/**
 * The 404 wears the same machine as the rest of the site: a rack the finder
 * probes lane by lane, with one lane that was never fitted. `my-auto` rather
 * than a centred flex parent, so a short viewport scrolls the whole page
 * instead of clipping the heading off the top.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center bg-background px-5 py-12 sm:px-8 sm:py-16">
      <div className="my-auto w-full max-w-[42rem]">
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <BrandMark size={22} />
          <span className="text-sm font-medium tracking-tight">Shadway</span>
        </Link>

        <p className="mt-9 font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
          error 404
        </p>
        <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-[2.3rem] sm:leading-[1.08]">
          This page was never filed.
        </h1>
        <p className="mt-3.5 max-w-[34rem] text-pretty text-[0.95rem] leading-relaxed text-muted-foreground">
          The finder seated its head over every lane and came back with an empty
          pocket. The page you asked for doesn&apos;t exist, or it has been moved
          somewhere else.
        </p>

        <div className="mt-8">
          <FinderProbe />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2.5">
          <Button asChild size="lg">
            <Link href="/">
              <Home />
              Back home
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/directory">
              <LayoutGrid />
              Browse the directory
            </Link>
          </Button>
        </div>

        <p className="mt-5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
          point at a lane, or use the arrow keys
        </p>
      </div>
    </main>
  );
}
