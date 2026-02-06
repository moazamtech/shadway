"use client";

import Link from "next/link";
import Image from "next/image";
import { Github } from "lucide-react";

const PLATFORM_LINKS = [
  { label: "Component Library", href: "/docs" },
  { label: "AI Generator", href: "/component-generator" },
  { label: "Vibecode Gallery", href: "/vibecode" },
  { label: "Directory", href: "/directory" },
];

export function LandingFooter() {
  return (
    <footer>
      <div className="px-6 py-12 lg:px-12">
        <div className="grid gap-8 md:grid-cols-[1.5fr_1fr]">
          <div className="space-y-4">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <Image src="/logo.png" width={24} height={24} alt="Shadway" />
              <span className="font-serif text-lg tracking-tight">
                Shadway
              </span>
            </Link>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              An open-source platform for discovering docs components,
              generating new UI with AI, and publishing vibecoded work that
              ships faster.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6 text-sm">
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-foreground">
                Platform
              </p>
              {PLATFORM_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-foreground">
                Community
              </p>
              <Link
                href="https://github.com/moazamtech/shadway"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <Github className="h-3.5 w-3.5" />
                GitHub
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-dashed border-border pt-6 text-xs text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} Shadway</span>
          <span>Built for the open-source community</span>
        </div>
      </div>
    </footer>
  );
}
