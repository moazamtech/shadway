# Feature parity vs. the reference implementation

> Internal document. The reference is an open (MIT-licensed) community registry
> used purely as an architectural/UX blueprint — no proprietary services are
> copied (no Clerk, Supabase, R2, or private bundle host).

## Legend
- **Present** — feature exists and is functional.
- **Partial** — something exists; gap noted.
- **Missing** — not built yet.

## Core flow

| Capability | Reference evidence | Our status | Our evidence | Effort | Priority |
|---|---|---|---|---|---|
| Publish (build-once bundle + static cover) | `apps/web/publish`, `app/api/bundle` | Present | `components/studio/publish-panel.tsx`, `lib/preview/bundle.ts`, `app/api/components/route.ts` | — | — |
| Auth-gated publish | middleware + Clerk | Present | `app/api/components/route.ts` (`requireSession`), 401 verified | — | — |
| Discover feed (grid, search, filters) | `apps/web/app/page` | Present | `components/component-exchange-home.tsx` — the grid, the ⌘K palette (search + sort) and the category rail | — | — |
| Component detail (Preview/Code/Install) | `apps/web/c/[component]` | Present | `app/c/[slug]/page.tsx`, `components/marketplace/component-detail-client.tsx` | — | — |
| Fullscreen showcase from the feed | `apps/web/...` | Present | `components/marketplace/component-detail-dialog.tsx` — the page dims, the component takes the screen, the chevrons step through the grid, the copy menu takes the source, the page link, the registry address or the published document | — | — |
| Published document at its own address | `cdn/…/bundle.<ts>.html?theme=` | Present | `app/p/[slug]/route.ts` — the built component, with `?theme=dark` for the dark copy of the same bytes | — | — |
| Owner controls (PATCH/DELETE) | owner endpoints | Present | `app/api/components/[slug]/route.ts` (PATCH/DELETE, 401/403/200 verified) | — | — |
| Install (CLI / v0 / Lovable / Bolt + download) | install tabs | Present | `components/marketplace/install-tabs.tsx` | — | — |
| Registry endpoint (`/r/<slug>`) | `/r/<slug>` | Present | `app/r/[slug]/route.ts` + `lib/registry/index.ts`; installed for real by `scripts/qa-install.ts` | — | — |

## Studio

| Capability | Reference evidence | Our status | Our evidence | Effort | Priority |
|---|---|---|---|---|---|
| Full-page editor (Monaco) | `apps/web/studio` | Present | `components/studio/component-studio.tsx`, `studio-editor.tsx` | — | — |
| Collapsible file tree + packages panel | `use-file-system` hook | Present | studio shell | — | — |
| Live local preview (no remote bundler) | `sandbox` | Present | `components/studio/sandpack-preview.tsx`, `lib/preview/build.ts` | — | — |
| Separate publish page | `publish` | Present | `components/studio/publish-panel.tsx` | — | — |
| Import a component from a repository | — | Present | `app/api/studio/import-github/route.ts`, `components/studio/import-github-dialog.tsx` — a repository is listed by folder, the author picks the files, the paths are rewritten to the project's | — | — |
| AI-assisted generation / chat | `magic`, `magic-chat` | Partial | `app/component-generator/page.tsx`, `app/vibecode/*` — generation exists; no interactive refine chat | L | P1 |

## Marketplace surfaces

| Capability | Reference evidence | Our status | Our evidence | Effort | Priority |
|---|---|---|---|---|---|
| Collections (save + group) | folders / lists | Present | `app/collections/**`, `lib/db/collections.ts` | — | — |
| Bookmarks / favorites | `bookmarks` | Present | `lib/db/marketplace.ts`, `components/marketplace/...` | — | — |
| Votes / likes count (atomic $inc) | upvotes | Present | marketplace data layer | — | — |
| Author pages (`/u/<username>`) | `[username]` | Present | `app/u/[username]/page.tsx` (the only profile page; `/profile` 307s here) | — | — |
| Bundles (groups of components, free/paid) | templates | Removed | routes and data layer are gone; `/r/bundle/*` no longer resolves | — | — |
| Studio dashboard (owner) | public-dashboard | Present | `components/studio/studio-dashboard.tsx`, `app/studio/page.tsx` | — | — |
| Multiple demos per component | `demos/*` | Missing | — | M | P2 |
| Component reviews / comments | threads | Missing | — | M | P2 |
| on_review / posted / featured workflow | publish states | Missing (we use draft/published/hidden/flagged) | — | M | P2 |

## User / account

| Capability | Reference evidence | Our status | Our evidence | Effort | Priority |
|---|---|---|---|---|---|
| Credentials auth + register | Clerk (we use next-auth) | Present | `lib/auth.ts`, `app/api/register/route.ts`, `app/login`, `app/register`, `components/auth/*` | — | — |
| User profile | `[username]` | Present | `app/u/[username]/page.tsx`, `app/profile/page.tsx` (307) | — | — |
| Settings page | `settings` | Present | `app/settings/page.tsx`; 38 assertions in `scripts/qa-settings.ts` | — | — |
| Public developer dashboard | `public-dashboard` | Partial | `app/dashboard/page.tsx` is private owner view | M | P2 |
| Pricing / monetization page | `pricing`, `api-access` | Missing | — | L | P3 |

## Marketing / editorial

| Capability | Reference evidence | Our status | Our evidence | Effort | Priority |
|---|---|---|---|---|---|
| Landing page | `app/page` | Present | `app/page.tsx`, `components/landing/hero.tsx` | — | — |
| Templates page | `templates` | Partial | `app/template/page.tsx` | S | P2 |
| Contests / curated challenges | `contest` | Missing | — | L | P3 |
| Story / about | `our-story` | Missing | — | S | P3 |
| Maintenance page | `maintenance` | Missing | — (scaffolded) | S | P3 |
| Docs | extensive docs | Partial | `app/docs/**` | M | P2 |

## Responsiveness / UX

| Capability | Reference evidence | Our status | Our evidence | Effort | Priority |
|---|---|---|---|---|---|
| Mobile-first feed grid | yes | Present | `qa-home.ts` overflow 0 @375 | — | — |
| Hydration-clean client components | yes | Present | `components/marketplace/relative-time.tsx`; `qa-install.ts` loads the feed seconds after a publish | — | — |
| Dark mode | yes | Partial (verify per surface) | tokens via CSS vars | S | P1 |
| Command palette (⌘K) | likely | Present | `components/marketplace/command-palette.tsx` | — | — |
| Skeleton loading states | yes | Present | branded cover skeleton in `component-card.tsx`, poster-first loader in `preview/bundled-preview.tsx` | — | — |

## SEO / discovery

| Capability | Reference evidence | Our status | Our evidence | Effort | Priority |
|---|---|---|---|---|---|
| Sitemaps + feeds + robots | yes | Partial→improved | `app/sitemap-*`, `app/feed.*`, `app/robots.ts` (SEO agent in progress) | — | P1 |

## Highest-leverage next steps
1. **AI chat for component generation** - build an iterative chat over the existing generator.
2. **Multiple demos per component** — media loop (video.mp4 / preview.png) already captures a single cover; extend to N.
3. **Component review/comment thread** + status workflow (review queue).
4. **Public developer dashboard** — the owner view exists at `/studio`; the public one does not.
5. ~~**Command palette (⌘K)**~~ — done, `command-palette.tsx`.
6. **Dark-mode pass** across every touched surface.
7. **Docs overhaul** to match depth.

## Our verified metrics (current)
- `npx tsc --noEmit` → 0 errors.
- `npx eslint components app lib scripts` → **0 errors** (215 warnings, all pre-existing rule levels).
- `npm test` → 277 tests / 25 files pass.
- `qa-home` → all checks pass (cards, filters, sort, search, 0 hydration, 0 overflow @375/768/1440).
- `qa-owner-controls` → all checks pass (401 anonymous, 403 non-owner PATCH/DELETE, 200 owner, dashboard 200).
- `qa-auth` → all 16 checks pass, including the registry's JSON 404.
- `qa-publish-flow` → 8 fixtures build, publish and read back; a broken import is refused with the compiler's message.
- `qa-install` → the real `shadcn` CLI installs a UI item and a block into a scratch Next project; every import resolves and every package is declared.
- `qa-catalogue` → every published component answers on its page, serves its document in both themes, and its registry item has files.
- `qa-payouts` → a creator sees their balance, an address cannot be approved by the creator, a review of a different value is a conflict, and an accrual shows at the 70% share.
- `qa-payout-run` → the weekly run previews, writes one batch, claims the earnings, and writes nothing when the same week is run again.
- `qa-media` → a cover is an image, a demo video is a `/video/upload/` document that is served back as `video/mp4`, and HTML is not media.
- `qa-video` → nothing is fetched before the pointer arrives; on hover the video mounts, plays, and is delivered at the size it is painted.
- Anonymous publish → 401 (verified earlier).
