"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Route-level error boundary.
 *
 * Without one, any uncaught render error escapes to Next.js's raw error screen
 * — in production that is a bare "Application error" with no way back into the
 * app. This keeps the user inside the product and gives them a retry that
 * re-renders the segment rather than forcing a full reload.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaces in the server logs / error tracking with the digest that Next
    // also stamps onto the response, so a user-reported ref is traceable.
    console.error("Route error:", error);
  }, [error]);

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card p-8 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-well text-muted-foreground">
          <AlertTriangle className="h-5 w-5" />
        </span>

        <h1 className="mt-4 text-lg font-semibold tracking-tight">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This page hit an unexpected error. Trying again usually clears it.
        </p>

        {error.digest ? (
          <p className="mt-3 font-mono text-xs text-muted-foreground/80">
            ref {error.digest}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Button onClick={reset}>
            <RotateCcw className="h-4 w-4" />
            Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
