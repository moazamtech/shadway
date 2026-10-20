"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

type PaletteItem = {
  slug: string;
  title: string;
  category?: string;
  author: { name: string; username: string };
  tags: string[];
  views: number;
  installs: number;
};

/**
 * The three orders the palette can put the registry in.
 *
 * The sort used to live in a control on the feed's toolbar, next to a search
 * box, which made the toolbar a second search field and put two dropdowns in
 * the way of a page that is meant to be a catalogue. Sorting is a question
 * about the *result*, so it belongs with the result: it is here, under the
 * query, where the thing it reorders is.
 */
type Sort = "latest" | "popular" | "installs";

const SORTS: { id: Sort; label: string }[] = [
  { id: "latest", label: "Latest" },
  { id: "popular", label: "Popular" },
  { id: "installs", label: "Most installed" },
];

/**
 * ⌘K command palette for fast component search.
 *
 * Fetches the same feed the home page uses, filters client-side, and lets the
 * user jump straight to a component detail page.
 *
 * It is built on the app's own primitives — the same `Dialog` every other
 * overlay opens on, and the same `Command` list the rest of the product uses
 * for keyboard-driven picking — so ⌘K reads as part of the app rather than as
 * a third overlay system with its own dim, its own surface and its own
 * shadow. The list itself is cmdk's: the arrow keys, the active row and the
 * scroll-into-view are cmdk's, and this component only says which slug is
 * active and what happens when one is chosen.
 */
export function CommandPalette({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (slug: string) => void;
}) {
  const [items, setItems] = useState<PaletteItem[]>([]);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(open);
  const [sort, setSort] = useState<Sort>("latest");
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * The palette opens empty.
   *
   * The query, the active row and the loading flag belong to a showing, not
   * to the component: a palette that comes back with the last search still
   * typed into it is a palette that has forgotten what it was for. React
   * resets a value when something changes by comparing it with the value from
   * the previous render, so the previous showing is what has to be kept — and
   * the state is adjusted in the render that notices the change, before
   * anything is committed.
   */
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setLoading(true);
    }
  }

  // Load items once when opened.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/components?sort=latest&limit=100", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data.items)) setItems(data.items);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Focus the input after the dialog mounts.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const ordered = [...items].sort((a, b) => {
      if (sort === "popular") return b.views - a.views;
      if (sort === "installs") return b.installs - a.installs;
      return 0;
    });
    if (!q) return ordered.slice(0, 12);
    return ordered
      .filter((item) => {
        return (
          item.title.toLowerCase().includes(q) ||
          item.tags.some((tag) => tag.toLowerCase().includes(q)) ||
          item.author.username.toLowerCase().includes(q) ||
          item.author.name.toLowerCase().includes(q) ||
          (item.category ?? "").toLowerCase().includes(q)
        );
      })
      .slice(0, 12);
  }, [items, query, sort]);

  /** The slug cmdk keeps active. It is the list's own selection, mirrored. */
  const activeSlug = results[activeIndex]?.slug ?? "";

  /**
   * cmdk moved the active row — with the arrow keys or the pointer — so the
   * component's own index follows it. cmdk owns the selection; this only
   * remembers where it is, so the next render can hand it straight back.
   */
  function handleActiveChange(value: string) {
    const index = results.findIndex((item) => item.slug === value);
    if (index !== -1) setActiveIndex(index);
  }

  function handleQueryChange(next: string) {
    setQuery(next);
    setActiveIndex(0);
  }

  function handleSortChange(next: Sort) {
    setSort(next);
    setActiveIndex(0);
    // The sort is a mouse-first control, but it must not take the keyboard
    // away from the query it reorders.
    inputRef.current?.focus();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="gap-0 overflow-hidden p-0 sm:max-w-xl"
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Search components by title, tag, category or author.
        </DialogDescription>

        <Command
          shouldFilter={false}
          loop={false}
          vimBindings={false}
          value={activeSlug}
          onValueChange={handleActiveChange}
          className="h-auto rounded-none [&_[cmdk-input]]:h-12 [&_[data-slot=command-input-wrapper]]:h-12"
        >
          {/* The query. */}
          <div className="relative">
            <CommandInput
              ref={inputRef}
              value={query}
              onValueChange={handleQueryChange}
              placeholder="Search components, tags, authors..."
              aria-label="Search components"
              className="pr-14"
            />
            <kbd className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded-md border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              ESC
            </kbd>
          </div>

          {/* The sort: three pills that reorder what the query found. */}
          <div className="flex items-center gap-1.5 border-b px-4 py-2">
            {SORTS.map((option) => (
              <button
                key={option.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onKeyDown={(e) => {
                  // The list owns Enter: it opens the active row. A pill
                  // answers for itself instead.
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSortChange(option.id);
                  }
                }}
                onClick={() => handleSortChange(option.id)}
                aria-pressed={sort === option.id}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                  sort === option.id
                    ? "border-foreground/20 bg-foreground/10 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* The results. */}
          <CommandList
            label="Search results"
            className="max-h-[50vh] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {loading && items.length === 0 ? (
              <div className="space-y-2 p-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-md p-2">
                    <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
                      <div className="h-2.5 w-1/4 animate-pulse rounded bg-muted" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <CommandEmpty>
                  <p className="text-[13.5px] font-medium">No results</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Try a different search term.
                  </p>
                </CommandEmpty>

                {results.map((item) => (
                  <CommandItem
                    key={item.slug}
                    value={item.slug}
                    onSelect={() => onSelect(item.slug)}
                    className="group gap-3 rounded-md px-3 py-2.5 text-[13.5px]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate leading-4 font-medium">
                          {item.title}
                        </span>
                        {item.category ? (
                          <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[11px] tracking-wider text-muted-foreground uppercase">
                            {item.category}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        @{item.author.username}
                        {item.tags.length > 0 &&
                          ` · ${item.tags.slice(0, 3).join(", ")}`}
                      </div>
                    </div>
                    <ArrowRight
                      className="mt-0.5 h-4 w-4 shrink-0 opacity-0 transition-opacity group-data-[selected=true]:opacity-100"
                      aria-hidden="true"
                    />
                  </CommandItem>
                ))}
              </>
            )}
          </CommandList>

          {/* The keyboard, written down. */}
          <div className="flex items-center gap-4 border-t bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="rounded border bg-popover px-1 py-0.5 text-[10px]">
                ↑↓
              </kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border bg-popover px-1 py-0.5 text-[10px]">
                ↵
              </kbd>
              open
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border bg-popover px-1 py-0.5 text-[10px]">
                esc
              </kbd>
              close
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
