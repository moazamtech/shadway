"use client";

import { BorderBeam } from "@/components/ui/borderbeam";
import { Highlighter } from "@/components/ui/highlighter";
import { ThemeToggle } from "@/components/theme-toggle";
import Image from "next/image";

export function DocsFooter() {
  return (
    <div className="border-border border-dashed border-t">
      <div className="relative mx-auto max-w-(--breakpoint-xl) px-4 sm:px-8 border-border border-dashed border-r border-l overflow-hidden">
        <BorderBeam
          borderWidth={1}
          reverse
          initialOffset={50}
          className="from-transparent via-blue-500 to-transparent"
        />

        <footer className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 py-5">
          <div>
            <div className="text-balance text-sm leading-loose text-primary">
              Built by{" "}
              <Image
                src="/profile.jpeg"
                alt="Moazam Butt"
                width={20}
                height={20}
                className="inline-block rounded-2xl"
              />{" "}
              <Highlighter color="rgba(79, 139, 255, 0.32)" padding={3} action="highlight">
                <a
                  href="https://x.com/moazamtech"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium"
                  data-umami-event="View X Profile"
                >
                  moazamtech
                </a>
              </Highlighter>
              . The source code is available on{" "}
              <Highlighter color="rgba(79, 139, 255, 0.32)" action="underline" >
                <a
                  href="https://github.com/moazamtech/shadway"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium"
                  data-umami-event="View GitHub Repository"
                >
                  GitHub
                </a>
              </Highlighter>
              .
            </div>
          </div>

          <ThemeToggle />
        </footer>
      </div>
    </div>
  );
}
