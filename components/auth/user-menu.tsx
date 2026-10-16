"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { ChevronDown, LogOut, Sparkles } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function initialsFor(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function firstNameFor(value: string) {
  return value.trim().split(/\s+/)[0] || value;
}

interface UserMenuProps {
  variant?: "desktop" | "mobile";
  isScrolled?: boolean;
}

/**
 * Navbar auth area.
 *
 * `useSession` starts in the "loading" state on both the server and the first
 * client render, so we render a fixed-size skeleton until the session resolves.
 * That keeps the tree identical across hydration and avoids any mismatch.
 */
export function UserMenu({ variant = "desktop", isScrolled = false }: UserMenuProps) {
  const { data: session, status } = useSession();

  const surface = isScrolled
    ? "bg-background/60 border-border/30 hover:bg-background/80"
    : "bg-background/40 border-border/20 hover:bg-background/60";

  if (status === "loading") {
    return (
      <Skeleton
        aria-hidden
        className={cn(
          "backdrop-blur-md",
          variant === "desktop"
            ? "h-10 w-24 rounded-xl"
            : "h-10 w-10 rounded-2xl",
        )}
      />
    );
  }

  if (status !== "authenticated" || !session?.user) {
    return (
      <Button
        asChild
        variant="ghost"
        size="sm"
        className={cn(
          "border font-medium transition-all duration-300",
          variant === "desktop"
            ? "h-10 rounded-xl px-4 backdrop-blur-md"
            : "h-10 rounded-2xl px-3 text-sm shadow-lg backdrop-blur-xl",
          surface,
        )}
      >
        <Link
          href="/login"
          className="text-muted-foreground hover:text-foreground"
        >
          Sign in
        </Link>
      </Button>
    );
  }

  const name = session.user.name || session.user.email || "Account";
  const email = session.user.email ?? "";
  // `image` is not part of the declared session shape in lib/auth.ts yet, so
  // read it defensively the same way lib/session.ts does.
  const image = (session.user as { image?: string }).image;

  if (variant === "mobile") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Account menu"
            className={cn(
              "h-10 w-10 rounded-2xl border shadow-lg backdrop-blur-xl transition-all duration-300",
              surface,
            )}
          >
            <Avatar className="h-6 w-6">
              {image ? <AvatarImage src={image} alt={name} /> : null}
              <AvatarFallback className="bg-foreground/10 text-[10px] font-medium text-foreground">
                {initialsFor(name)}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <UserMenuContent name={name} email={email} />
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "group h-10 gap-2 rounded-xl border px-2.5 backdrop-blur-md transition-all duration-300",
            surface,
          )}
        >
          <Avatar className="h-6 w-6">
            {image ? <AvatarImage src={image} alt={name} /> : null}
            <AvatarFallback className="bg-foreground/10 text-[10px] font-medium text-foreground">
              {initialsFor(name)}
            </AvatarFallback>
          </Avatar>
          <span className="max-w-[96px] truncate text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground">
            {firstNameFor(name)}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <UserMenuContent name={name} email={email} />
    </DropdownMenu>
  );
}

function UserMenuContent({ name, email }: { name: string; email: string }) {
  return (
    <DropdownMenuContent align="end" className="w-56 rounded-xl">
      <DropdownMenuLabel className="flex flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-foreground">
          {name}
        </span>
        {email ? (
          <span className="truncate text-xs font-normal text-muted-foreground">
            {email}
          </span>
        ) : null}
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild>
        <Link href="/studio" className="cursor-pointer">
          <Sparkles className="h-4 w-4" />
          Studio
        </Link>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        variant="destructive"
        className="cursor-pointer"
        onSelect={() => {
          void signOut({ callbackUrl: "/" });
        }}
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}
