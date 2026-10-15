import Link from "next/link";
import type { ReactNode } from "react";
import {
  CalendarDays,
  FolderOpen,
  Github,
  Globe,
  Link2,
  Twitter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ProfileTab = {
  id: string;
  label: string;
  count: number;
};

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatJoined(value?: Date): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <p className="text-base leading-6 font-semibold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

/**
 * The profile body, shared by the owner's own page and the public one.
 *
 * Two columns, in the shape the best registries use: identity on the left
 * (avatar, name, handle, bio, links, stats), work on the right behind tabs.
 * The tabs are links carrying `?tab=`, so the pages stay server-rendered and
 * a tab is shareable.
 */
export function ProfileBody({
  handle,
  name,
  avatar,
  bio,
  website,
  twitter,
  github,
  joinedAt,
  isOwner,
  tabs,
  activeTab,
  basePath,
  stats,
  children,
}: {
  handle: string;
  name: string;
  avatar?: string;
  bio?: string;
  website?: string;
  twitter?: string;
  github?: string;
  joinedAt?: Date;
  isOwner: boolean;
  tabs: ProfileTab[];
  activeTab: string;
  /** The page a tab link points at; defaults to the current one. */
  basePath: string;
  stats: { components: number; views: number; likes: number; installs: number };
  children: ReactNode;
}) {
  const joined = formatJoined(joinedAt);
  const links = [
    website ? { href: website, icon: Globe, label: "Website" } : null,
    twitter
      ? {
          href: twitter.startsWith("http")
            ? twitter
            : `https://x.com/${twitter.replace(/^@/, "")}`,
          icon: Twitter,
          label: "X",
        }
      : null,
    github
      ? {
          href: github.startsWith("http") ? github : `https://github.com/${github}`,
          icon: Github,
          label: "GitHub",
        }
      : null,
  ].filter(Boolean) as { href: string; icon: typeof Globe; label: string }[];

  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 py-6 lg:px-8 lg:py-8">
      <div className="flex flex-col gap-8 md:flex-row md:gap-10">
        {/* Identity */}
        <aside className="w-full shrink-0 md:w-[248px]">
          <div className="flex flex-col items-center text-center md:items-start md:text-left">
            <span className="relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-well ring-1 ring-border">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatar}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-xl font-semibold text-muted-foreground">
                  {initialsFor(name || handle)}
                </span>
              )}
            </span>

            <h1 className="mt-4 text-xl font-semibold tracking-tight">
              {name}
            </h1>
            <p className="text-sm text-muted-foreground">@{handle}</p>

            {bio ? (
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {bio}
              </p>
            ) : null}

            {links.length ? (
              <div className="mt-3 flex items-center gap-3">
                {links.map(({ href, icon: Icon, label }) => (
                  <Link
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Icon className="h-4 w-4" />
                  </Link>
                ))}
              </div>
            ) : null}

            {joined ? (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                Joined {joined}
              </p>
            ) : null}

            {isOwner ? (
              <div className="mt-4 flex w-full flex-col gap-2">
                <Button asChild size="sm" className="w-full">
                  <Link href="/studio">Open studio</Link>
                </Button>
                <div className="flex gap-2">
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="flex-1"
                  >
                    <Link href="/bookmarks">Bookmarks</Link>
                  </Button>
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="flex-1"
                  >
                    <Link href="/settings">Settings</Link>
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2">
            <Stat label="Components" value={formatCount(stats.components)} />
            <Stat label="Views" value={formatCount(stats.views)} />
            <Stat label="Likes" value={formatCount(stats.likes)} />
            <Stat label="Installs" value={formatCount(stats.installs)} />
          </div>
        </aside>

        {/* Work */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-0.5 overflow-x-auto border-b border-border">
            {tabs.map((tab) => {
              const active = tab.id === activeTab;
              return (
                <Link
                  key={tab.id}
                  href={`${basePath}?tab=${tab.id}`}
                  aria-current={active ? "page" : undefined}
                  scroll={false}
                  className={cn(
                    "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "border-foreground text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.label}
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {tab.count}
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="mt-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** The empty state shared by every profile tab. */
export function ProfileEmpty({
  icon = "components",
  title,
  body,
  action,
}: {
  icon?: "components" | "saved";
  title: string;
  body: string;
  action?: ReactNode;
}) {
  const Icon = icon === "saved" ? FolderOpen : Link2;
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-16 text-center">
      <span className="flex size-11 items-center justify-center rounded-lg bg-well text-muted-foreground">
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-4 text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-[420px] text-sm text-muted-foreground">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
