"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bookmark,
  FolderOpen,
  Home,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  Sparkles,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { findGroup, normalizeGroup } from "@/lib/categories";
import { Separator } from "@/components/ui/separator";
import { BrandMark } from "@/components/brand-mark";
import { UserMenu } from "@/components/user-menu";
import {
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  useSidebar,
} from "@/lib/sidebar-state";

/* ------------------------------------------------------------------- css -- */

/* The shared hover treatment for rail rows: an absolute pill layer that
   fills with the app's one hover tone (--accent), so a lit row on the rail
   matches a lit row in a menu; pressing releases it back toward the rail.
   The interactive parent carries `group/row` and `relative`, and its visible
   children `relative` so they paint above the pill. */
function RowPill({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute inset-0 rounded-lg transition-[background-color] duration-150 ease-out group-hover/row:bg-accent group-active/row:bg-accent-pressed",
        className
      )}
    />
  );
}

/* Flat nav row: icon and label share the soft chrome ink; hover fills the
   pill. Collapses to a centered icon on the rail — left-anchored at all
   times, so the icon never jumps, the label just fades under the sliding
   edge. */
const ROW =
  "group/row sidebar-glide relative flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[13.5px]/4 font-medium text-foreground-soft transition-[padding] sidebar-collapsed:pl-3";

/* Width rides `--sidebar-width` (painted pre-hydration by the layout script,
   driven live by useSidebar), so drags track 1:1 and the collapse toggle
   glides on this curve — the same one the rest of the shell uses. */
const GLIDE =
  "transition-[width,padding,opacity,visibility] duration-[240ms] ease-[cubic-bezier(0.32,0.72,0,1)]";

/* Chrome that hides when the rail is collapsed to icons. */
const FADE =
  "relative min-w-0 truncate transition-[opacity,visibility] duration-150 sidebar-collapsed:invisible sidebar-collapsed:opacity-0";

/* --------------------------------------------------------------- rebuild -- */

type RailNavItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
};

const NAV: RailNavItem[] = [
  { title: "Home", href: "/", icon: Home, exact: true },
  { title: "Collections", href: "/collections", icon: FolderOpen },
  { title: "Bookmarks", href: "/bookmarks", icon: Bookmark },
  { title: "Studio", href: "/studio", icon: Sparkles },
  { title: "Profile", href: "/profile", icon: User },
  { title: "Settings", href: "/settings", icon: Settings },
];

type CatalogItem = {
  title: string;
  slug: string;
  count: number;
};

type CatalogGroup = {
  slug: string;
  label: string;
  items: CatalogItem[];
};

/** The rail's list reads the same feed endpoint as the grid it sits next to,
 *  so the two can never drift. */
function useRailCatalog(): CatalogGroup[] | null {
  const [groups, setGroups] = React.useState<CatalogGroup[] | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    fetch("/api/components?sort=latest&limit=100", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("feed"))))
      .then((data) => {
        if (cancelled || !Array.isArray(data.items)) return;
        const map = new Map<string, CatalogGroup>();
        for (const item of data.items as Array<{
          title?: string;
          slug?: string;
          category?: string;
          installs?: number;
        }>) {
          if (!item.slug || !item.title) continue;
          /* Key on the taxonomy's group, not on the stored string. Every
             component in the database was filed under one of the ad-hoc
             lists, so keying on the raw value gave the rail a "hero"
             section and a "blocks" section and a "marketing" section — three
             sections over one category, each linking to a different query
             than the header count implies. normalizeGroup is what folds them
             back together, and findGroup is what turns the key back into
             something worth reading. The feed still decides what appears:
             an empty group is simply absent, because it is never seeded. */
          const slug = normalizeGroup(item.category);
          const group =
            map.get(slug) ??
            ({
              slug,
              label: findGroup(slug)?.title ?? slug,
              items: [],
            } satisfies CatalogGroup);
          group.items.push({
            title: item.title,
            slug: item.slug,
            count: typeof item.installs === "number" ? item.installs : 0,
          });
          map.set(slug, group);
        }
        setGroups(
          Array.from(map.values())
            .sort((a, b) => b.items.length - a.items.length)
            .slice(0, 8)
        );
      })
      .catch(() => {
        if (!cancelled) setGroups([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return groups;
}

/* ------------------------------------------------------------------ rows -- */

function RailRow({
  icon: RowIcon,
  label,
  active,
  href,
  onClick,
  trailing,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  href?: string;
  onClick?: () => void;
  trailing?: React.ReactNode;
  className?: string;
}) {
  const body = (
    <>
      <RowPill className={active ? "bg-accent" : undefined} />
      {RowIcon ? (
        <span className="relative shrink-0">
          <RowIcon className="h-4 w-4" />
        </span>
      ) : null}
      <span className={FADE}>{label}</span>
      {trailing !== undefined ? (
        <span className="relative ml-auto shrink-0 text-xs tabular-nums text-muted-foreground sidebar-collapsed:hidden">
          {trailing}
        </span>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(ROW, className)}
      >
        {body}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={cn(ROW, className)}
    >
      {body}
    </button>
  );
}

/* ------------------------------------------------------------------ rail -- */

export function SidebarRail({
  onSearch,
  onNavigate,
  activeCategory,
  className,
}: {
  /** ⌘K palette trigger — the row doubles as the Search affordance. */
  onSearch?: () => void;
  /** Called after a link click; the mobile drawer uses it to close itself. */
  onNavigate?: () => void;
  activeCategory?: string;
  className?: string;
}) {
  const pathname = usePathname();
  const catalog = useRailCatalog();
  const {
    collapsed,
    width,
    resizing,
    toggleCollapsed,
    onResizePointerDown,
    onResizeDoubleClick,
  } = useSidebar();

  const isActive = (item: RailNavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <aside
      id="app-sidebar"
      className={cn(
        /* The rail wears the tinted canvas itself (no panel of its own) —
           the tint washes --background, and the surface panel floats on top.
           While a drag is live the width must track the pointer 1:1, so the
           glide comes off for the duration. */
        "group/sidebar relative shrink-0 flex-col gap-2 pt-3 pb-2",
        "w-[var(--sidebar-width,16rem)] px-3",
        resizing ? "" : GLIDE,
        className
      )}
      onClickCapture={onNavigate}
    >
      {/* Brand + collapse toggle. The toggle sits in-flow expanded but
          overlays the mark when collapsed, crossfading on hover. */}
      <div className="sidebar-glide relative flex h-7 items-center px-1.5 transition-[padding] sidebar-collapsed:pl-2.5">
        <Link
          href="/"
          className="flex items-center gap-2"
          aria-label="Shadway home"
        >
          <BrandMark
            size={20}
            className="transition-opacity duration-150 sidebar-collapsed:group-hover/sidebar:opacity-0"
          />
          <span
            className={cn(
              "text-sm font-semibold tracking-tight text-foreground",
              FADE
            )}
          >
            Shadway
          </span>
        </Link>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="sidebar-glide ml-auto -mr-1.5 hidden size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-foreground-soft opacity-0 transition-[opacity,background-color] duration-150 group-hover/sidebar:opacity-100 hover:bg-accent focus-visible:opacity-100 sidebar-collapsed:absolute sidebar-collapsed:inset-0 sidebar-collapsed:m-auto sidebar-collapsed:opacity-0 sidebar-collapsed:group-hover/sidebar:opacity-100 md:flex"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2">
        {/* Primary pill. The glaze is a translucent background-image gradient
            over the fill, so hover still animates the color beneath it. */}
        <Link
          href="/studio"
          className="relative inline-flex h-8 w-full cursor-pointer items-center justify-start gap-2 rounded-lg bg-primary bg-linear-to-b from-white/25 to-white/0 px-3 text-sm font-medium text-primary-foreground transition-[background-color,scale] duration-150 ease-out hover:bg-(--primary-hover) active:scale-[0.96]"
        >
          <Plus className="h-4 w-4 shrink-0" strokeWidth={2.5} />
          <span
            className={cn(
              "overflow-hidden whitespace-nowrap transition-[opacity,visibility] duration-150 sidebar-collapsed:invisible sidebar-collapsed:opacity-0"
            )}
          >
            New component
          </span>
        </Link>

        <nav className="-mt-1.5 flex flex-col gap-0.5">
          <RailRow
            icon={Search}
            label="Search"
            onClick={onSearch}
            trailing={
              <kbd className="rounded border bg-muted px-1.5 font-sans text-[11px] leading-none text-muted-foreground">
                ⌘K
              </kbd>
            }
          />
          {NAV.map((item) => (
            <RailRow
              key={item.href}
              icon={item.icon}
              label={item.title}
              href={item.href}
              active={isActive(item)}
            />
          ))}
        </nav>

        <Separator className="sidebar-glide mx-1.5 transition-[margin] sidebar-collapsed:mx-0" />

        {/* Component list — the rail's thread-list analogue: grouped by
            category, scrollable in the leftover height. */}
        <nav
          aria-label="Components"
          className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-0.5 pb-1"
        >
          {catalog === null ? (
            <div className="flex flex-col gap-1">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="flex h-8 items-center gap-2.5 px-2.5"
                >
                  <span className="h-3.5 w-full max-w-[120px] animate-pulse rounded bg-muted sidebar-collapsed:hidden" />
                </div>
              ))}
            </div>
          ) : (
            catalog.map((group) => (
              <div key={group.slug} className="flex flex-col gap-0.5">
                <Link
                  href={
                    group.slug === "all"
                      ? "/"
                      : `/?category=${encodeURIComponent(group.slug)}`
                  }
                  className={cn(
                    "flex h-6 items-center gap-2 px-2.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase transition-colors hover:text-foreground sidebar-collapsed:hidden",
                    activeCategory === group.slug && "text-foreground"
                  )}
                >
                  <span className="truncate">{group.label}</span>
                  <span className="ml-auto tabular-nums">
                    {group.items.length}
                  </span>
                </Link>
                {[...group.items]
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 6)
                  .map((item) => (
                    <RailRow
                      key={item.slug}
                      label={item.title}
                      href={`/c/${item.slug}`}
                      active={pathname === `/c/${item.slug}`}
                      trailing={item.count}
                    />
                  ))}
              </div>
            ))
          )}
        </nav>
      </div>

      <UserMenu variant="row" />

      {/* The rail's resize handle: drag to set the width (persisted), double
          click to come home to the default. Hidden while collapsed and on
          phones, where the rail rides a drawer instead. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        aria-valuenow={width}
        aria-valuemin={SIDEBAR_MIN_WIDTH}
        aria-valuemax={SIDEBAR_MAX_WIDTH}
        onPointerDown={onResizePointerDown}
        onDoubleClick={onResizeDoubleClick}
        className={cn(
          "absolute inset-y-0 right-0 z-10 block w-1.5 max-md:hidden cursor-col-resize touch-none transition-colors duration-150 sidebar-collapsed:hidden",
          resizing ? "bg-foreground/15" : "hover:bg-foreground/10"
        )}
      />
    </aside>
  );
}
