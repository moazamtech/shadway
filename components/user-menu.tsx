"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import {
  Bookmark,
  ChevronUp,
  LayoutDashboard,
  LogIn,
  LogOut,
  Settings,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Account entry point for regular users.
 *
 * Two faces of the same menu: the round avatar used in top bars
 * (`variant="avatar"`, the default) and the full-width row the sidebar rail
 * mounts in its footer (`variant="row"`). Admins get an extra link into the
 * panel; everyone else sees only the surfaces they can actually use, which
 * keeps the two roles distinguishable at a glance.
 */
export function UserMenu({
  variant = "avatar",
}: {
  variant?: "avatar" | "row";
}) {
  const { data: session, status } = useSession();

  const row = variant === "row";

  if (status === "loading") {
    return row ? (
      <div className="flex h-11 items-center gap-2.5 px-2">
        <div className="size-9 shrink-0 animate-pulse rounded-lg bg-accent" />
        <div className="flex min-w-0 flex-col gap-1.5 sidebar-collapsed:hidden">
          <div className="h-3 w-20 animate-pulse rounded bg-accent" />
          <div className="h-2.5 w-12 animate-pulse rounded bg-accent" />
        </div>
      </div>
    ) : (
      <div className="size-8 animate-pulse rounded-lg bg-muted" />
    );
  }

  /* Signed out: the rail shows the same row shape as any other entry, with
     the sign-in icon in its own little well (the reference's pattern). */
  if (!session?.user) {
    if (!row) {
      return (
        <Button variant="outline" size="sm" asChild>
          <Link href="/login">Sign in</Link>
        </Button>
      );
    }
    return (
      <Link
        href="/login"
        className="group/row flex h-11 w-full items-center gap-2.5 overflow-hidden rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-foreground-soft transition-colors group-hover/row:bg-background sidebar-collapsed:-ml-1.5 sidebar-glide">
          <LogIn className="h-4 w-4" />
        </span>
        <span className="flex min-w-0 flex-col sidebar-collapsed:hidden">
          <span className="truncate text-[13.5px] leading-4 font-medium">
            Sign in
          </span>
          <span className="truncate text-xs text-muted-foreground">
            Save components
          </span>
        </span>
      </Link>
    );
  }

  const admin = session.user.role === "admin";
  const label = session.user.name || session.user.email || "Account";
  const sub = admin ? "Admin" : (session.user.email ?? "Account");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className={
            row
              ? "group/row flex h-11 w-full cursor-pointer items-center gap-2.5 overflow-hidden rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent"
              : "flex size-8 items-center justify-center rounded-lg bg-accent text-xs font-semibold text-foreground-soft transition-colors hover:bg-muted"
          }
        >
          {row ? (
            <>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-xs font-semibold text-foreground-soft transition-colors group-hover/row:bg-background sidebar-collapsed:-ml-1.5 sidebar-glide">
                {label.slice(0, 2).toUpperCase()}
              </span>
              <span className="flex min-w-0 flex-col sidebar-collapsed:hidden">
                <span className="truncate text-[13.5px] leading-4 font-medium">
                  {label}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {sub}
                </span>
              </span>
              <ChevronUp className="ml-auto h-4 w-4 shrink-0 text-muted-foreground sidebar-collapsed:hidden" />
            </>
          ) : (
            label.slice(0, 2).toUpperCase()
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={row ? "start" : "end"}
        side={row ? "top" : "bottom"}
        className="w-56"
      >
        <DropdownMenuLabel className="truncate">{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/profile">
            <Sparkles className="h-4 w-4" />
            Profile
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link href="/bookmarks">
            <Bookmark className="h-4 w-4" />
            Bookmarks
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>

        {admin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin/dashboard">
                <LayoutDashboard className="h-4 w-4" />
                Admin panel
              </Link>
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut({ callbackUrl: "/" })}>
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
