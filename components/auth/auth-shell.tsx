import Image from "next/image";
import Link from "next/link";

import { Skeleton } from "@/components/ui/skeleton";
import { BrandMark } from "@/components/brand-mark";
import { listComponents } from "@/lib/db/components";
import { coverImageUrl } from "@/lib/images";
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
 * The frame for /login and /register.
 *
 * Two columns on a wide screen: the marketplace itself on the left, the form
 * on the right. The left column is not decoration — it is the actual
 * catalogue, the same covers the feed draws, so a stranger who has not signed
 * in can see what they are signing in to before they type anything. On a
 * phone the stage is gone and the form has the whole screen, because a phone
 * has no room for a poster.
 *
 * The form column keeps the marketplace's own chrome: the app's mark, the
 * app's type sizes, the app's field treatment, and a hairline rather than a
 * card around it — the marketplace does not put its pages in cards, and a
 * sign-in form is a page.
 */
export async function AuthShell({
  title,
  subtitle,
  children,
  footer,
  className,
}: AuthShellProps) {
  const covers = await listComponents({ sort: "popular", limit: 4 })
    .then((rows) =>
      rows
        .filter((row) => Boolean(row.thumbnailUrl))
        .map((row) => ({
          title: row.title,
          cover: coverImageUrl(row.thumbnailUrl, 640),
        })),
    )
    .catch(() => []);

  return (
    <main className="grid min-h-dvh bg-background lg:grid-cols-[1.05fr_0.95fr]">
      {/* The stage — the marketplace, on the left of a wide screen. */}
      <section
        aria-hidden="true"
        className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-surface p-10 lg:flex"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage:
              "radial-gradient(ellipse at 30% 20%, black 10%, transparent 70%)",
          }}
        />

        <Link
          href="/"
          className="relative flex w-fit items-center gap-2.5 rounded-lg outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <BrandMark size={22} />
          <span className="text-sm font-semibold tracking-tight text-foreground">
            Shadway
          </span>
        </Link>

        <div className="relative max-w-md">
          <p className="text-[11px] font-semibold tracking-[0.22em] text-muted-foreground uppercase">
            The shadcn component exchange
          </p>
          <p className="mt-3 text-2xl leading-tight font-semibold tracking-tight text-foreground">
            Components you can install with one command, published by the people
            who built them.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Every component is a real registry item: the source, its
            dependencies and its preview, and an address the shadcn CLI installs
            from.
          </p>
        </div>

        {covers.length ? (
          <div className="relative grid grid-cols-2 gap-3">
            {covers.map((cover) => (
              <div
                key={cover.title}
                className="overflow-hidden rounded-xl border border-border/60 bg-background"
              >
                <div className="relative aspect-[16/10] w-full">
                  <Image
                    src={cover.cover ?? ""}
                    alt=""
                    fill
                    sizes="320px"
                    className="object-cover"
                  />
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {/* The form. */}
      <section className="flex flex-col justify-center px-5 py-10 sm:px-8 lg:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Link
            href="/"
            className="mb-8 flex w-fit items-center gap-2.5 rounded-lg outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
          >
            <BrandMark size={22} />
            <span className="text-sm font-semibold tracking-tight text-foreground">
              Shadway
            </span>
          </Link>

          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>

          <div className="mt-7">{children}</div>
        </div>

        {footer ? (
          <div className="mx-auto mt-7 w-full max-w-sm text-center text-sm text-muted-foreground">
            {footer}
          </div>
        ) : null}
      </section>
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
