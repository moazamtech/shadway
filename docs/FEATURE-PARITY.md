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
| Discover feed (grid, search, filters) | `apps/web/app/page` | Partial | `components/component-exchange-home.tsx` — search debounce + category filter + sort added | M | P1 |
| Component detail (Preview/Code/Install) | `apps/web/c/[component]` | Present | `components/marketplace/component-detail.tsx`, `app/c/[slug]/page.tsx` | — | — |
| Owner controls (PATCH/DELETE) | owner endpoints | Present | `app/api/components/[slug]/route.ts` (PATCH/DELETE, 401/403/200 verified) | — | — |
| Install (CLI / v0 / Lovable / Bolt + download) | install tabs | Present | `components/marketplace/install-tabs.tsx` | — | — |
| Registry endpoint (`/r/<slug>`) | `/r/<slug>` | Present | `app/r/[slug]/route.ts` (and bundles) | — | — |

## Studio

| Capability | Reference evidence | Our status | Our evidence | Effort | Priority |
|---|---|---|---|---|---|
| Full-page editor (Monaco) | `apps/web/studio` | Present | `components/studio/component-studio.tsx`, `studio-editor.tsx` | — | — |
| Collapsible file tree + packages panel | `use-file-system` hook | Present | studio shell | — | — |
| Live local preview (no remote bundler) | `sandbox` | Present | `components/preview/local-preview.tsx` | — | — |
| Separate publish page | `publish` | Present | `components/studio/publish-panel.tsx` | — | — |
| AI-assisted generation / chat | `magic`, `magic-chat` | Partial | `app/component-generator/page.tsx`, `app/vibecode/*` — generation exists; no interactive refine chat | L | P1 |

## Marketplace surfaces

| Capability | Reference evidence | Our status | Our evidence | Effort | Priority |
|---|---|---|---|---|---|
| Collections (save + group) | folders / lists | Present | `app/collections/**`, `lib/db/collections.ts` | — | — |
| Bookmarks / favorites | `bookmarks` | Present | `lib/db/marketplace.ts`, `components/marketplace/...` | — | — |
| Votes / likes count (atomic $inc) | upvotes | Present | marketplace data layer | — | — |
| Author pages (`/u/<username>`) | `[username]` | Present | `app/u/[username]/page.tsx` | — | — |
| Bundles (groups of components, free/paid) | templates | Present (ours) | `app/bundles/**`, `lib/db/bundles.ts`, `app/r/bundle/[slug]` | — | — |
| Studio dashboard (owner) | public-dashboard | Present | `components/marketplace/studio-dashboard.tsx`, `app/dashboard/page.tsx` | — | — |
| Multiple demos per component | `demos/*` | Missing | — | M | P2 |
| Component reviews / comments | threads | Missing | — | M | P2 |
| on_review / posted / featured workflow | publish states | Missing (we use draft/published/hidden/flagged) | — | M | P2 |

## User / account

| Capability | Reference evidence | Our status | Our evidence | Effort | Priority |
|---|---|---|---|---|---|
| Credentials auth + register | Clerk (we use next-auth) | Present | `lib/auth.ts`, `app/api/register/route.ts`, `app/login`, `app/register`, `components/auth/*` | — | — |
| User profile | `[username]` | Present | `app/u/[username]/page.tsx`, `app/profile/page.tsx` | — | — |
| Settings page | `settings` | Missing | — | M | P2 |
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
| Hydration-clean client components | yes | Present | `COMPONENTS` verified 0 hydration warnings | — | — |
| Dark mode | yes | Partial (verify per surface) | tokens via CSS vars | S | P1 |
| Command palette (⌘K) | likely | Missing | — | M | P2 |
| Skeleton loading states | yes | Partial | `qa-home.ts` skeleton; others TBD | S | P2 |

## SEO / discovery

| Capability | Reference evidence | Our status | Our evidence | Effort | Priority |
|---|---|---|---|---|---|
| Sitemaps + feeds + robots | yes | Partial→improved | `app/sitemap-*`, `app/feed.*`, `app/robots.ts` (SEO agent in progress) | — | P1 |

## Highest-leverage next steps
1. **AI chat ("magic") for component generation** — biggest 21st differentiator; build an iterative chat over the existing generator.
2. **Multiple demos per component** — media loop (video.mp4 / preview.png) already captures a single cover; extend to N.
3. **Component review/comment thread** + status workflow (review queue).
4. **User settings + public developer dashboard** parity.
5. **Command palette (⌘K)** for search across components/authors/tags.
6. **Dark-mode pass** across every touched surface.
7. **Docs overhaul** to match depth.

## Our verified metrics (current)
- `npx tsc --noEmit` → 0 errors.
- Lint (new surface) → 0 errors.
- `qa-home` → all checks pass (cards, filters, sort, search, 0 hydration, 0 overflow @375/768/1440).
- `qa-owner-controls` → all checks pass (401 anonymous, 403 non-owner PATCH/DELETE, 200 owner, dashboard 200).
- `qa-auth` → all 16 checks pass.
- Anonymous publish → 401 (verified earlier).
