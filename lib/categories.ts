import {
  Dock,
  Group,
  type LucideIcon,
} from "lucide-react";

/**
 * The one place a component's category is defined.
 *
 * ## Why this file exists
 *
 * Before it, five disconnected places each held their own idea of what a
 * category could be — the studio's publish form, the admin's "new component"
 * form, the public submit form, the collections page, and the marketplace
 * sidebar, which derived its groups from whatever happened to be in the
 * database. Nothing agreed with anything else.
 *
 * Worse, the registry item took its `type` straight from that free text. The
 * shadcn CLI accepts a fixed set — `registry:ui`, `registry:block`,
 * `registry:hook`, `registry:lib`, `registry:style`, `registry:example` — and a
 * component filed under `hero` shipped `"type": "registry:hero"`, which is not
 * one of them. It built, it served, and `shadcn add` had nothing to install.
 *
 * So a category here is a **group**, and a group is a valid registry type.
 * What the component *is* is carried by tags, which is also how the taxonomy is
 * shaped: a button can be a button and an animation and a form all at once, so
 * the exclusive field stays exclusive and the many-valued field stays
 * many-valued.
 */

/** The two groups a component can belong to. Each is a valid registry type. */
export type CategoryGroup = {
  /** Stored in `ComponentDocument.category`. */
  slug: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** The `type` a registry item built from this group declares. */
  registryType: "registry:ui" | "registry:block";
};

export type CategoryTag = {
  /** Stored in `ComponentDocument.tags`. */
  slug: string;
  title: string;
  /** Which group a component in this category belongs to. */
  group: string;
};

export const CATEGORY_GROUPS: readonly CategoryGroup[] = [
  {
    slug: "ui",
    title: "UI Components",
    description: "Components and primitives that drop into an existing app.",
    icon: Group,
    registryType: "registry:ui",
  },
  {
    slug: "marketing",
    title: "Marketing Blocks",
    description: "Sections that make up a landing page or a product site.",
    icon: Dock,
    registryType: "registry:block",
  },
] as const;

function tags(group: string, entries: ReadonlyArray<readonly [string, string]>): CategoryTag[] {
  return entries
    .map(([slug, title]) => ({ slug, title, group }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

/** What a component is, in two groups. Mirrors the taxonomy the reference uses. */
export const CATEGORY_TAGS: readonly CategoryTag[] = [
  ...tags("marketing", [
    ["announcement", "Announcements"],
    ["auth", "Auth"],
    ["background", "Backgrounds"],
    ["banner", "Banners"],
    ["bento", "Bento Grids"],
    ["border", "Borders"],
    ["call-to-action", "Calls to Action"],
    ["clients", "Clients"],
    ["comparison", "Comparisons"],
    ["contact", "Contacts"],
    ["dock", "Docks"],
    ["features", "Features"],
    ["footer", "Footers"],
    ["header", "Headers"],
    ["hero", "Heroes"],
    ["hook", "Hooks"],
    ["image", "Images"],
    ["map", "Maps"],
    ["navbar-navigation", "Navigation Menus"],
    ["pricing-section", "Pricing Sections"],
    ["scroll-area", "Scroll Areas"],
    ["testimonials", "Testimonials"],
    ["text", "Texts"],
    ["video", "Videos"],
  ]),
  ...tags("ui", [
    ["accordion", "Accordions"],
    ["ai-chat", "AI Chats"],
    ["alert", "Alerts"],
    ["avatar", "Avatars"],
    ["badge", "Badges"],
    ["button", "Buttons"],
    ["calendar", "Calendars"],
    ["card", "Cards"],
    ["carousel", "Carousels"],
    ["checkbox", "Checkboxes"],
    ["date-picker", "Date Pickers"],
    ["modal-dialog", "Dialogs / Modals"],
    ["dropdown", "Dropdowns"],
    ["empty-state", "Empty States"],
    ["file-tree", "File Trees"],
    ["upload-download", "File Uploads"],
    ["form", "Forms"],
    ["icons", "Icons"],
    ["input", "Inputs"],
    ["link", "Links"],
    ["menu", "Menus"],
    ["notification", "Notifications"],
    ["number", "Numbers"],
    ["pagination", "Paginations"],
    ["popover", "Popovers"],
    ["radio-group", "Radio Groups"],
    ["sidebar", "Sidebars"],
    ["sign-in", "Sign Ins"],
    ["registration-signup", "Sign ups"],
    ["select", "Selects"],
    ["slider", "Sliders"],
    ["spinner-loader", "Spinner Loaders"],
    ["table", "Tables"],
    ["chip-tag", "Tags"],
    ["tabs", "Tabs"],
    ["textarea", "Text Areas"],
    ["toast", "Toasts"],
    ["toggle", "Toggles"],
    ["tooltip", "Tooltips"],
  ]),
];

/** What every value already in the database maps to. See `normalizeGroup`. */
const LEGACY_GROUP_ALIASES: Record<string, string> = {
  // Grouped with the UI components they read as.
  ui: "ui",
  animation: "ui",
  form: "ui",
  data: "ui",
  general: "ui",
  icons: "ui",
  // Section-shaped, so a block.
  block: "marketing",
  blocks: "marketing",
  marketing: "marketing",
  hero: "marketing",
  contact: "marketing",
  footer: "marketing",
  about: "marketing",
  feature: "marketing",
  features: "marketing",
  pricing: "marketing",
  hooks: "marketing",
};

/** The group a value belongs to, or `null` when it names neither group. */
export function findGroup(slug: string): CategoryGroup | null {
  const key = slug.trim().toLowerCase();
  return CATEGORY_GROUPS.find((group) => group.slug === key) ?? null;
}

/**
 * The sub-categories of a group.
 *
 * A group is a shelf; the sub-categories are the kinds of thing on it. A
 * reader who wants a button should not have to know that buttons are filed
 * under "UI components", and a reader who wants a hero should not have to
 * know that heroes are filed under "marketing blocks" — the shelf is the
 * coarse way in and the kind is the fine one.
 */
export function tagsForGroup(group: string): readonly CategoryTag[] {
  const key = group.trim().toLowerCase();
  return CATEGORY_TAGS.filter((tag) => tag.group === key);
}

/** The sub-category a stored tag names, or `null`. */
export function findTag(slug: string): CategoryTag | null {
  const key = slug.trim().toLowerCase();
  return CATEGORY_TAGS.find((tag) => tag.slug === key) ?? null;
}

/**
 * The group any stored value belongs to.
 *
 * Every component already in the database was filed under one of the ad-hoc
 * lists, so this is what makes them all still work: `hero` reads as a marketing
 * block, `animation` as a UI component, and anything unrecognised as a UI
 * component, which is what `"ui"` already meant everywhere it was hard-coded.
 */
export function normalizeGroup(value: string | null | undefined): string {
  const key = (value ?? "").trim().toLowerCase();
  if (findGroup(key)) return key;
  return LEGACY_GROUP_ALIASES[key] ?? "ui";
}

/** The `type` a registry item built from a component must declare. */
export function registryTypeFor(value: string | null | undefined): "registry:ui" | "registry:block" {
  return findGroup(normalizeGroup(value))?.registryType ?? "registry:ui";
}

/**
 * Every value a component might actually be *stored* under that reads as
 * `group` — the query side of `normalizeGroup`.
 *
 * `normalizeGroup` answers "which group is this component in?" by rewriting the
 * value in the UI. A database query cannot do that. It matched
 * `category: "marketing"` against the stored string, and every component filed
 * before the taxonomy existed is stored as `block` or `hero` or `pricing` —
 * so the category the sidebar links to returned an empty grid while the header
 * counted one item. A count that disagrees with the grid beneath it is worse
 * than either being wrong alone.
 *
 * So the query is expanded to the whole equivalence class instead: the two
 * canonical group slugs, plus every legacy alias that resolves to them. Held
 * here rather than in the route so the taxonomy stays the only place that knows
 * which old names exist.
 */
export function storedCategoriesFor(group: string): string[] {
  const target = normalizeGroup(group);
  const aliases = Object.keys(LEGACY_GROUP_ALIASES).filter(
    (alias) => LEGACY_GROUP_ALIASES[alias] === target
  );
  // The canonical slug is listed even when no alias spells it, so the result is
  // never empty for a real group.
  return [target, ...aliases.filter((alias) => alias !== target)];
}

/** How a value reads when we do not recognise it — never blank. */
export function tagTitle(slug: string): string {
  const key = slug.trim().toLowerCase();
  if (!key) return "Uncategorized";
  return findTag(key)?.title ?? key.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** The group a tag's components are filed under. */
export function groupForTag(slug: string): string {
  return findTag(slug)?.group ?? normalizeGroup(slug);
}

/** The tags of one group, in display order. */
export function tagsInGroup(group: string): CategoryTag[] {
  const key = normalizeGroup(group);
  return CATEGORY_TAGS.filter((tag) => tag.group === key);
}
