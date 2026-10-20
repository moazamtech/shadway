"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Layers,
  Megaphone,
  PanelLeftClose,
  PanelLeftOpen,
  Shapes,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { findGroup, normalizeGroup, tagsForGroup } from "@/lib/categories";
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
   children `relative` so they paint above the pill.

   The pill is also where "you are here" lives. Fill is the one part of a row
   that survives the collapsed rail — the label is gone by then, the icon
   alone cannot carry the difference — so the selected tone has to be a
   stronger surface than the hover tone rather than a heavier label. The rail
   runs a four-step ladder, each rung one little closer to the ink:
   rest (the canvas) → hover (--accent) → selected → selected under the
   pointer. Selected therefore rides --foreground at 10% and 15% instead of
   another grey — the same two tints the rail's own resize handle lifts
   through, and the only ones that step further in the same direction in both
   themes: the theme has nothing between --accent and the canvas (--muted and
   --input land on the hover tone's own step, --well IS the canvas), and dark
   climbs where light descends. */
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

/* One left gutter for everything the rail stacks — rows, the primary pill,
   the category headers. It has to be a single value rather than a padded
   state and a plainer collapsed one: the collapsed rail is 64px wide and 24px
   of that is its own padding, so one 12px gutter leaves exactly 16px inside
   — the icon's own width — and centres it dead on the rail. Two gutters
   meant the icon nudged a couple of pixels sideways every time the rail
   collapsed, which read as a crooked column of icons rather than a rail. */
const GUTTER = "px-3";

/* One type scale for the rail's controls: the nav rows and the primary pill
   beside them are the same kind of thing at the same size, and 13.5 against
   a pill's 14 was a half-pixel disagreement nobody could name but everyone
   could feel. */
const TYPE = "text-[13.5px]/4 font-medium";

/* Flat nav row: icon and label share the soft chrome ink; the fill under
   them is the pill's job, and the selected row overrides that fill and the
   label's ink (see RailRow). Hover lifts the ink to full as well, so a row
   you are about to click reads as lit before it is clicked. The focus ring
   is inset because the rows sit two pixels apart — an outset ring would
   reach into the neighbouring rows and into the rail's own padding.

   The row is padded 10px, not the rail's 12: the invisible `::before` layer
   below reaches the rail's edges and splits the gaps between neighbours, so a
   click in the dead space between two rows still lands on one of them. That
   is why the padding and the hit area are two different numbers. */
const ROW =
  `group/row sidebar-glide relative flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 ${TYPE} text-foreground-soft transition-[padding,color] duration-150 ease-out group-hover/row:text-foreground before:absolute before:-inset-x-3 before:top-0 before:bottom-0 sidebar-collapsed:pl-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring`;

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

/**
 * The rail's places.
 *
 * One row, because the rail is a list of *places* and the feed is the only
 * place that is not a category. Everything about the person reading it — their
 * profile, what they have saved, the studio, the settings — belongs to the
 * account menu at the foot of the column, where the account itself is; a
 * second copy of it halfway up the rail is two places to keep in step and
 * nothing to gain.
 *
 * The admin is a different set of places in the same column, so the rail
 * takes its navigation rather than insisting on its own.
 */
const NAV: RailNavItem[] = [{ title: "Home", href: "/", icon: Home, exact: true }];
type CatalogGroup = {
  slug: string;
  label: string;
  /** How many published components are filed under it. */
  count: number;
  /** The kinds of thing on this shelf, and how many of each there are. */
  tags: { slug: string; label: string; count: number }[];
};

/**
 * The mark beside a category.
 *
 * The rail's rows are identified by their icons, so the categories need one
 * too: a shape for "the things you drop into an app" and a different one for
 * "the sections a landing page is made of". A category that is only a word is
 * a label; a category with a shape is a place.
 */
const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  ui: Shapes,
  marketing: Megaphone,
};

/**
 * The rail's categories.
 *
 * The rail is a column of places, not a second catalogue: it used to list
 * individual components under each category, which made the sidebar a copy of
 * the feed with two fewer columns and a different sort. Now it lists the
 * categories themselves, with the number of components in each, and the
 * grid does the rest.
 *
 * The counts come from the same feed endpoint the grid reads, so the number
 * beside a category is the number of cards behind it rather than a number
 * kept somewhere else.
 */
function useRailCatalog(): CatalogGroup[] | null {
  const [groups, setGroups] = React.useState<CatalogGroup[] | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    fetch("/api/components?sort=latest&limit=100", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("feed"))))
      .then((data) => {
        if (cancelled || !Array.isArray(data.items)) return;
        const counts = new Map<string, number>();
        const tagCounts = new Map<string, Map<string, number>>();
        for (const item of data.items as Array<{ category?: string; tags?: string[] }>) {
          /* Key on the taxonomy's group, not on the stored string. Every
             component in the database was filed under one of the ad-hoc lists,
             so keying on the raw value gave the rail a "hero" section and a
             "blocks" section and a "marketing" section — three sections over
             one category, each counting a different set than the header
             implies. normalizeGroup is what folds them back together, and
             findGroup is what turns the key back into something worth
             reading. */
          const slug = normalizeGroup(item.category);
          counts.set(slug, (counts.get(slug) ?? 0) + 1);

          const group = tagCounts.get(slug) ?? new Map<string, number>();
          for (const tag of item.tags ?? []) {
            const key = tag.trim().toLowerCase();
            if (!key) continue;
            group.set(key, (group.get(key) ?? 0) + 1);
          }
          tagCounts.set(slug, group);
        }
        setGroups(
          Array.from(counts.entries())
            .map(([slug, count]) => ({
              slug,
              label: findGroup(slug)?.title ?? slug,
              count,
              tags: tagsForGroup(slug).map((tag) => ({
                slug: tag.slug,
                label: tag.title,
                count: tagCounts.get(slug)?.get(tag.slug) ?? 0,
              })),
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8),
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
  variant = "row",
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  href?: string;
  onClick?: () => void;
  trailing?: React.ReactNode;
  /**
   * "sub" is a row nested under another row — the kinds of thing on a shelf.
   * It has no icon of its own: the indentation says what it is, and an icon
   * per sub-category would be forty little drawings in a column.
   */
  variant?: "row" | "sub";
  className?: string;
}) {
  const sub = variant === "sub";

  const body = (
    <>
      {/* A selected row does not inherit the hover/press pair — it overrides
          both, so putting the pointer on the current page cannot demote it
          back to looking hovered. Same variant prefix, later in the list, so
          tailwind-merge swaps the two out rather than layering them. */}
      <RowPill
        className={cn(
          active &&
            "bg-foreground/10 group-hover/row:bg-foreground/15 group-active/row:bg-foreground/15"
        )}
      />
      {RowIcon ? (
        <span className="relative shrink-0">
          <RowIcon className="h-4 w-4" />
        </span>
      ) : null}
      <span className={cn(FADE, sub && "text-[13px] text-muted-foreground")}>{label}</span>
      {trailing !== undefined ? (
        <span
          className={cn(
            "relative ml-auto shrink-0 text-xs tabular-nums text-muted-foreground transition-colors duration-150 ease-out group-hover/row:text-foreground-soft sidebar-collapsed:hidden",
            active && "text-foreground-soft"
          )}
        >
          {trailing}
        </span>
      ) : null}
    </>
  );

  const row = cn(
    ROW,
    active && "text-foreground",
    // A sub-row is indented to the shelf's content edge, so the eye reads
    // the nesting without a line or a box to draw it.
    sub && "h-7 pl-7 text-[13px] text-muted-foreground sidebar-collapsed:hidden",
    className,
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={row}
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
      className={row}
    >
      {body}
    </button>
  );
}

/* ------------------------------------------------------------------ rail -- */

export function SidebarRail({
  onNavigate,
  activeCategory,
  activeTag,
  nav,
  className,
}: {
  /** Called after a link click; the mobile drawer uses it to close itself. */
  onNavigate?: () => void;
  /** The category the feed is showing, so the rail can light it. */
  activeCategory?: string;
  /** The sub-category the feed is showing, so the rail can light it. */
  activeTag?: string;
  /**
   * The rail's places, when they are not the marketplace's.
   *
   * The admin is a different set of places in the same column, and giving it
   * the same column — the same width, the same rows, the same account menu at
   * the foot — is what makes the admin part of this product rather than a
   * second one wearing a different skin.
   */
  nav?: RailNavItem[];
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

  const navItems = nav ?? NAV;

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
        "w-[var(--sidebar-width,14rem)] px-3",
        resizing ? "" : GLIDE,
        className
      )}
      onClickCapture={onNavigate}
    >
      {/* Brand + collapse toggle. The toggle sits in-flow expanded but
          overlays the mark when collapsed, crossfading on hover. */}
      <div className="sidebar-glide relative flex h-7 items-center px-1.5 transition-[padding] sidebar-collapsed:pl-1">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
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
          className="sidebar-glide ml-auto -mr-1.5 hidden size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-foreground-soft opacity-0 transition-[opacity,background-color] duration-150 group-hover/sidebar:opacity-100 hover:bg-accent focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sidebar-collapsed:absolute sidebar-collapsed:inset-0 sidebar-collapsed:m-auto sidebar-collapsed:opacity-0 sidebar-collapsed:group-hover/sidebar:opacity-100 md:flex"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2">
        {/* The nav sits on the same two-pixel pitch as the rows inside it, so
            the column reads as one stack rather than as a list with a heading
            above it. The negative margin pulls it up onto the brand row's
            rhythm: eight pixels between the blocks, two between the rows.

            There is no search row. ⌘K opens the palette from anywhere, and a
            button that says what the keyboard already does is a button that
            takes the top of the column to say it. */}
        <nav className="-mt-1.5 flex flex-col gap-0.5">
          {navItems.map((item) => (
            <RailRow
              key={item.href}
              icon={item.icon}
              label={item.title}
              href={item.href}
              active={isActive(item)}
            />
          ))}
        </nav>

        <Separator className="sidebar-glide mx-1.5 -my-1 transition-[margin] sidebar-collapsed:mx-0" />

        {/* Categories — the rail's lower half. They are the places the feed
            can be narrowed to, so they are rows like every other row in the
            column, not a second list of what is already on the page. A rail
            that was given its own navigation has no categories to offer. */}
        {nav ? null : (
        <nav
          aria-label="Categories"
          className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-0.5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {catalog === null ? (
            <div className="flex flex-col gap-1">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className={`flex h-8 items-center gap-2.5 ${GUTTER}`}
                >
                  <span className="h-3.5 w-full max-w-[120px] animate-pulse rounded bg-muted sidebar-collapsed:hidden" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <span
                className={`px-3 pt-1 text-[11px] font-semibold tracking-[0.16em] text-muted-foreground/70 uppercase sidebar-collapsed:hidden`}
              >
                Categories
              </span>
              <div className="flex flex-col gap-0.5">
                {catalog.map((group) => (
                  <div key={group.slug} className="flex flex-col gap-0.5">
                    <RailRow
                      icon={CATEGORY_ICONS[group.slug] ?? Layers}
                      label={group.label}
                      href={`/?category=${encodeURIComponent(group.slug)}`}
                      active={activeCategory === group.slug && !activeTag}
                      trailing={
                        <span className="text-[11px] tabular-nums text-muted-foreground/80">
                          {group.count}
                        </span>
                      }
                    />
                    {/* The kinds of thing on the shelf, indented under it.
                        A shelf of forty buttons is not browsable; a shelf of
                        "buttons" and "inputs" is. */}
                    <div className="flex flex-col gap-px">
                      {group.tags.map((tag) => (
                        <RailRow
                          key={tag.slug}
                          label={tag.label}
                          href={`/?category=${encodeURIComponent(group.slug)}&tag=${encodeURIComponent(tag.slug)}`}
                          active={activeTag === tag.slug}
                          variant="sub"
                          trailing={
                            tag.count > 0 ? (
                              <span className="text-[10px] tabular-nums text-muted-foreground/60">
                                {tag.count}
                              </span>
                            ) : null
                          }
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </nav>
        )}
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

