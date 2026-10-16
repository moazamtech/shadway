# Overnight Work Brief — shadway

**Repo:** `C:\Users\user\Desktop\shadway` (public repo: github.com/moazamdotdev/shadway)
**Branch:** `feature/shadway-component-exchange`
**Started:** 2026-10-16 03:39 PKT

## Hard rules (never break)

1. **NEVER** mention the reference project (`21st`) in commit messages, file names, comments, or PR text. Public repo. Clean generic messages.
2. **Do not touch** `C:\Users\user\Desktop\21st` — reference material only, read-only.
3. **No history rewriting:** no `git reset --hard`, no `git checkout -- .`, no `git clean -fd`, no force-push. All existing commits and code are preserved. Only additive commits.
4. Verify everything with **real output**: `npx tsc --noEmit`, `npx next build`, and curl against the running dev server. Never invent results.
5. Commit frequently, granularly, and review before `git add -A`.

## Shell gotcha (critical on this host)

Bash here is MSYS and exports `MSYS_NO_PATHCONV=1`, which **breaks native Windows binaries** (opencode, git, node, npm) by mangling path args. Always prefix:

```
unset MSYS_NO_PATHCONV; unset MSYS2_ARG_CONV_EXCL;
```

and pass native paths as `C:/Users/...` forward-slash form. Never `cd /c/...` for native tools.

## Environment facts (verified)

- Node v26.7.0, npm 11.19.0, pnpm 12.11.2, **bun NOT installed** (repo has `bun.lock`).
- Next.js **15.5.27** → latest stable is **16.4.2** (upgrade is on the list). React latest 19.3.1.
- Stack: Next 15 + React 19 + Tailwind v4 + MongoDB native driver + NextAuth v4 (credentials) + Cloudinary + OpenRouter.
- `.env` fully populated: MONGODB_URI, NEXTAUTH_SECRET, OPENROUTER_API_KEY, CLOUDINARY_*.
- DB name is `shadcn-hub` (see `lib/mongodb.ts`).
- Dev server: port **3001** (3000 is taken). `npx next dev --turbopack`.
- opencode v2.0.29 installed at `/c/Users/user/AppData/Roaming/npm/opencode`.

## Verified free models (opencode provider, tested 2026-10-16)

Working:
- `opencode/nemotron-3.5-lightning-free`
- `opencode/cat-jam-free`
- `opencode/nemotron-3-ultra-free`

Rate-limited (retry later, rotate):
- `opencode/longcat-2.5-preview-free`, `opencode/deepseek-v4.1-flash-free`,
  `opencode/mimo-v2.6-flash-free`, `opencode/space-bunny-free`

Geo-blocked (unusable here):
- `opencode/muse-spark-1.3-contributor-free` — "not available in your country"

Usage: `opencode run --standalone --auto --model "opencode/nemotron-3.5-lightning-free" "task"`
(needs the `unset MSYS_NO_PATHCONV` prefix).

## Confirmed bugs found

1. **API 500s** on `/api/components`, `/api/auth/session`, `/api/preview/transpile` — were caused by a **stale `.next` cache**. Fixed by `rm -rf .next`. Re-verify after any cache change.
2. **Server→client prop serialization**: Mongo `ObjectId` and `Date` objects passed straight into client components:
   > "Only plain objects can be passed to Client Components from Server Components. Objects with toJSON methods are not supported."
   Needs a serialization boundary (ObjectId→string, Date→ISO string) at every boundary.

## Work queue (in order)

- **A. BUGFIX** — every API route + page returns 200. Verify: `/api/components`, `/api/auth/session`, `/api/preview/transpile`, `/api/components/bookmarks`, `/api/me`, `/api/admin/users`, `/api/submissions`, `/api/websites`, `/api/collections`, `/api/registry`, `/api/studio/sandbox`, `/api/vibecode`, `/api/generate-component`.
- **B. BUGFIX** — serialization boundary (`serializeComponent()` in `lib/db/components.ts` or `lib/serialize.ts`). Apply at homepage feed, `/c/[slug]`, `/u/[username]`, dashboard, studio, collections, bookmarks.
- **C. UPGRADE** — Next 15.5.27 → 16.4.2. Update `next.config.ts`, `middleware.ts` (renamed to proxy in 16), async `cookies()`/`headers()`/`params`, Route Handler context params are `Promise`. Verify with full build + route smoke test. If 16.x breaks next-auth v4, fall back to highest 15.x patch and say why.
- **D. UI** — rebuild card + detail modal, unique/classy/premium, NOT a copy of any existing marketplace. **Remove views and likes counters from the card face entirely** (user explicitly doesn't want them shown). Installs only, quiet secondary detail. Card click → rich dialog with live preview, description, tags, install command, author, share, save/bookmark. Dialog has an explicit "Open full page" action → `/c/[slug]`. Share = copy link + native share. Bookmark persists and reflects optimistically.
- **E. LIKES** — real liking. New Mongo collection `likes` (userId + componentSlug, unique compound index). API `/api/components/[slug]/like` (POST toggle, DELETE) + like-count read. Heart button in card + modal, optimistic, per-account.
- **F. SCALE** — for 100k users: `ensureComponentIndexes`, cursor pagination instead of bare `.limit()`, safe caching headers, no N+1 per card. Pragmatic, no speculative abstraction.
- **G. ORGANIZE** — finish dead-file cleanup (`component-sandpack-preview.tsx`, `sandpack-preview.tsx` already staged as deleted). Group `lib/` by domain (`db/`, `preview/`, `registry/`, `studio/`, `auth/`, `utils/`) and `components/` (`ui/`, `marketplace/`, `studio/`, `preview/`, `settings/`). No orphans. Don't rename files others import without updating every import.
- **H. REPORT** — commit everything, then write `.hermes-logs/overnight-report.md`: fixed, upgraded, verified (real output), still broken, deliberately not done.

## Route inventory (all pages)

admin/{ai-models,components/new,components,dashboard,login,settings,submissions,templates,vibe-components,websites}, bookmarks, c/[slug], category/[slug], chatbot, collections, component-generator, dashboard, databases, directory, docs, docs/[category], landing, login, new, page(home), preview/[name], profile, register, settings, studio, studio/[slug], submit, template, u/[username], vibecode, vibecode/[slug], website/[slug]

## Blocker note

The `cronjob_manage` deferred tool fails to create jobs in this session ("not a known tool name"). Working directly instead.
