import Image from "next/image";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  /** Cross-links rendered under the card, e.g. "Sign in instead". */
  footer?: React.ReactNode;
  className?: string;
}

/**
 * Shared frame for /login and /register.
 *
 * Keeps the marketplace's visual language: centred card, Shadway wordmark,
 * serif heading, muted subtitle, token-based palette so light and dark both
 * read well. The decorative glows are pointer-events-none and aria-hidden so
 * they never interfere with the form underneath.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  className,
}: AuthShellProps) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-12 sm:px-6">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-15%] h-[360px] w-[360px] -translate-x-1/2 rounded-full bg-foreground/[0.04] blur-3xl" />
        <div className="absolute bottom-[-20%] right-[-10%] h-[320px] w-[320px] rounded-full bg-foreground/[0.03] blur-3xl" />
      </div>

      <Card
        className={cn(
          "w-full max-w-md gap-6 rounded-xl border-border/60 bg-card/80 py-8 shadow-sm backdrop-blur-xl",
          className,
        )}
      >
        <CardHeader className="flex flex-col items-center gap-3 px-6 text-center sm:px-8">
          <Link
            href="/"
            className="flex w-fit items-center gap-2.5 rounded-lg outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Image
              src="/logo.png"
              width={32}
              height={32}
              alt="Shadway"
              className="h-8 w-8 rounded-lg"
            />
            <span className="text-sm font-semibold tracking-tight text-foreground">
              Shadway
            </span>
          </Link>
          <CardTitle className="font-serif text-2xl tracking-tight text-balance sm:text-3xl">
            {title}
          </CardTitle>
          <CardDescription className="max-w-xs text-balance">
            {subtitle}
          </CardDescription>
        </CardHeader>

        <CardContent className="px-6 sm:px-8">{children}</CardContent>
      </Card>

      {footer ? (
        <div className="mt-6 w-full max-w-md text-center text-sm text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </main>
  );
}

/** Stable placeholder shown while `useSearchParams` resolves inside Suspense. */
export function AuthFormSkeleton() {
  return (
    <div aria-hidden className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-4 w-14" />
        <Skeleton className="h-8 w-full rounded-md" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-full rounded-md" />
      </div>
      <Skeleton className="h-8 w-full rounded-md" />
    </div>
  );
}
