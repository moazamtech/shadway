"use client";

import { BorderBeam } from "@/components/ui/borderbeam";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import Image from "next/image";
import Link from "next/link";

export function Header() {
  return (
    <div className="sticky top-0 z-50 border-border border-b border-dashed bg-background">
      <div className="relative mx-auto flex max-w-(--breakpoint-xl) items-center justify-between border-border border-r border-l border-dashed px-4 sm:px-8 overflow-hidden">
        <BorderBeam borderWidth={1} reverse initialOffset={80} className="from-transparent via-blue-500 to-transparent" />
        <Link className="flex items-center space-x-2 py-5" href="/docs">
          <Image src="/logo.png" alt="Shadway Logo" width={30} height={30} />
          <h1 className="font-bold text-xl">Shadway</h1>
        </Link>
        <div className="flex items-center space-x-2">
          <a
            href="https://github.com/moazamtech/shadway"
            target="_blank"
            rel="noreferrer"
            aria-label="View GitHub repository"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "h-10 w-10 rounded-xl bg-background/40 backdrop-blur-md border border-border/20 hover:bg-background/60 transition-all duration-200"
            )}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4 text-foreground"
              role="img"
              fill="currentColor"
            >
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
            </svg>
          </a>

          <a
            href="https://x.com/moazamtech"
            target="_blank"
            rel="noreferrer"
            aria-label="View X profile"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "h-10 w-10 rounded-xl bg-background/40 backdrop-blur-md border border-border/20 hover:bg-background/60 transition-all duration-200"
            )}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4 text-foreground"
              role="img"
              fill="currentColor"
            >
              <path d="M18.9 3H15.7L12 8.2 8.4 3H3.1L9.5 11.7 3 21h3.2L12 14.1 16.7 21H21L14.5 12.1 18.9 3z" />
            </svg>
          </a>

          <ThemeToggle />

        </div>
      </div>
    </div>
  );
}
