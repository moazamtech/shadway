"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import Image from "next/image";

export function DocsFooter() {
  return (
    <div className="border-border border-dashed border-t">
      <div className="mx-auto max-w-(--breakpoint-xl) px-4 sm:px-8 border-border border-dashed border-r border-l">
        <footer className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 py-5">
          <div>
            <div className="text-balance text-sm leading-loose text-muted-foreground">
              Built by{" "}
         <Image src="/profile.jpeg" alt="Shadway Logo" width={20} height={20} className="inline-block rounded-2xl"/>{" "}
              <a
                target="_blank"
                rel="noreferrer"
                className="font-medium underline underline-offset-4"
                data-umami-event="View Twitter Profile"
              >
                moazamtech
              </a>
              . The source code is available on{" "}
              <a
                target="_blank"
                rel="noreferrer"
                className="font-medium underline underline-offset-4"
                data-umami-event="View GitHub Repository"
              >
                GitHub
              </a>
              .
            </div>
          </div>

          <ThemeToggle />
        </footer>
      </div>
    </div>
  );
}

