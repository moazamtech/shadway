import type { PreviewFiles } from "@/lib/preview/files";

/**
 * The files a new component project starts from.
 *
 * The layout is the one this site ships with: a Next.js App Router project —
 * `app/` for the demo page, `components/` for the component being written,
 * `lib/` and `hooks/` for whatever shadcn/ui brings along. Only the author's
 * own files live here; the shadcn/ui folder is resolved from the registry
 * (`@/components/ui/button`), exactly like an installed shadcn project, so the
 * tree stays focused on what the author writes.
 */
export const DEFAULT_COMPONENT_CODE = `import { ArrowRight, Sparkles, Star } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const builders = ["AR", "JD", "MK", "SO"];

const stats = [
  { label: "Components", value: "180+" },
  { label: "Weekly installs", value: "12.4k" },
  { label: "Satisfaction", value: "98%" },
];

export default function MyComponent() {
  return (
    <section className="relative overflow-hidden px-6 py-20 sm:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute top-[-180px] left-1/2 h-[420px] w-[760px] max-w-[130%] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
      />

      <div className="relative mx-auto max-w-3xl text-center">
        <Badge variant="outline" className="px-3 py-1 text-xs">
          <Sparkles />
          24 new blocks this week
        </Badge>

        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          Interfaces that feel{" "}
          <span className="bg-gradient-to-r from-primary via-primary/80 to-primary/40 bg-clip-text text-transparent">
            effortless
          </span>
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-pretty text-muted-foreground sm:text-lg">
          This is the starter component. Rewrite it by hand, or describe what you
          want — every shadcn/ui primitive is one import away.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button size="lg" className="w-full rounded-full px-6 sm:w-auto">
            Start building
            <ArrowRight />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full rounded-full px-6 sm:w-auto"
          >
            Browse components
          </Button>
        </div>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <div className="flex -space-x-2">
            {builders.map((initials) => (
              <Avatar key={initials} className="size-8 border-2 border-background">
                <AvatarFallback className="text-[10px] font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-0.5 text-amber-500">
              {[0, 1, 2, 3, 4].map((star) => (
                <Star key={star} className="size-3.5 fill-current" />
              ))}
            </span>
            Loved by 12,400 builders
          </div>
        </div>
      </div>

      <Separator className="relative mx-auto mt-16 max-w-4xl" />

      <dl className="relative mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border bg-card p-5 text-center shadow-xs"
          >
            <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {stat.label}
            </dt>
            <dd className="mt-1 text-2xl font-semibold tracking-tight">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
`;

export const DEFAULT_DEMO_CODE = `import MyComponent from "@/components/component";

export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <MyComponent />
    </main>
  );
}
`;

export const DEFAULT_STYLE_CODE = `/* The preview already runs Tailwind v4 with the shadcn theme.
   Add project-specific styles here — they load after the theme. */
`;

/** The component the author publishes. */
export const DEFAULT_COMPONENT_PATH = "/components/component.tsx";
/** The page that renders it — `app/page.tsx`, like any App Router project. */
export const DEFAULT_DEMO_PATH = "/app/page.tsx";
/** The project stylesheet, imported by the app layout. */
export const DEFAULT_STYLE_PATH = "/app/globals.css";

export const STARTER_FILES: PreviewFiles = {
  [DEFAULT_COMPONENT_PATH]: DEFAULT_COMPONENT_CODE,
  [DEFAULT_DEMO_PATH]: DEFAULT_DEMO_CODE,
  [DEFAULT_STYLE_PATH]: DEFAULT_STYLE_CODE,
};

/** Copy so two drafts never share the same object. */
export function starterFiles(): PreviewFiles {
  return { ...STARTER_FILES };
}

/**
 * A stored support file's path, brought into the project layout.
 *
 * Records written before the app-folder layout kept everything under `src/`;
 * those paths are read as the root-relative ones they always meant.
 */
export function storedProjectPath(path: string): string {
  const clean = path.replace(/^\/+/, "").replace(/^src\//, "");
  return `/${clean}`;
}
