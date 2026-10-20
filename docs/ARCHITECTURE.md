# How shadway is put together

A short map of the code, for the people who have to change it. It is written
the way the code is written: what a thing is, and what breaks if it is done
differently.

## The shape of it

```
app/                    routes (App Router)
  page.tsx              the feed
  c/[slug]/             a component's page
  u/[username]/         a creator's profile — the only profile page
  studio/               the studio: a dashboard, and an editor per component
  settings/             the account
  new/                  the quick publish form
  admin/                the admin area
  p/[slug]/             the published document, on an address of its own
  r/[slug]/             the registry item the CLI installs from
  api/                  the routes the browser and the CLI talk to
components/
  marketplace/          the shell, the grid, the card, the showcase, the palette
  studio/               the editor, the file tree, the publish panel
  ui/                   the shadcn/ui primitives, plus the app's own
lib/
  registry/             what a registry item is, and how it is built
  preview/              the build: the bundle, the CSS, the template
  studio/               the starter project, the project's own paths
  payouts/              the money: amounts, the share, the plan
  db/                   Mongo, one module per collection
scripts/                the checks (qa-*.ts) and the maintenance jobs
```

## The three contracts

**A component is a file.** `lib/registry/index.ts` turns a stored component
into a registry item, and the item is the contract with the shadcn CLI: a
name, a type, files with paths, dependencies, and a `target` for every file
that has one. Two rules matter and both are easy to break.

The files that ship are the *reachable* ones: the entry, and everything it
imports by a relative, `@/` or `~/` path. A studio project holds a whole
application — a demo page, a stylesheet, the author's own helpers — and
shipping all of it installs a file nobody imports, at a path the consumer may
already own. `lib/registry/sources.ts` is where that walk lives, and the item
builder and the code viewer both read from it, so what the page shows and
what `shadcn add` writes are the same set.

A file that is not JavaScript or TypeScript is written verbatim as
`registry:file`. The CLI parses everything else as TSX before writing it, and
a stylesheet or a JSON file cannot survive that.

**A component is a document.** The published build is stored with the
component and served as a document: `/p/<slug>` is that document, and
`?theme=dark` is the same bytes with one attribute changed. The detail page
and the showcase draw the same build, so what a visitor sees and what a
stranger can link to are the same thing.

**Money moves on a schedule, and only with a key.** Accruals are recorded in
Mongo; the weekly run plans a week, writes a batch and claims the earnings it
covers. It stops there: the signing key is not in this application, so no
route here can move money. `lib/payouts/payouts.ts` is the arithmetic, and it
is a pure function over rows — which is what makes the rounding rule testable.

## The database

Postgres, on Neon, through Drizzle. The schema is `lib/db/schema.ts` and the
client is `lib/db/postgres.ts`; there is no second copy of the shape in a
migration folder to drift out of step.

The data was written for Mongo, and it moved without being rewritten: the same
documents, the same names, the same ids. Ids are text — a hex string — and
everything that referred to an id still refers to the same one. What changed is
where the bytes live and what enforces the rules: a unique index on a handle is
a promise the database keeps, and a column of `jsonb` is a place for a document
that has no shape of its own to live without pretending to be a table.

`scripts/migrate-to-neon.ts` is the one-off that copied everything across. It
is safe to run again: a row that is already there is written with the same
values, so an interrupted run can simply be repeated.

## The pieces worth knowing about

**The studio sandbox.** Sandpack runs in the visitor's browser, so the preview
is the author's code compiled by their own machine. Two things make that work:
the stylesheet is compiled on the server (Tailwind cannot be resolved in the
browser against the project's own `globals.css`), and the project is *latched*
per mount — the boot files are the ones the author had when the sandbox
started, not whatever the files are now. A dependency change remounts the
sandbox, and the latch is what makes the first sync after a remount a no-op
instead of a lost edit.

**The palette.** The ⌘K palette is mounted by the app shell, not by a page, so
the shortcut works everywhere. The feed's toolbar carries the count and
nothing else; the search and the sort live in the palette, under the query
they reorder.

**The author picture.** The account is the truth about who a person is, and
the copies on their components follow it: `syncAuthorAvatar` rewrites them
when a picture changes, and the session carries the current one. A picture
that appears on the profile and nowhere else is the bug this arrangement
exists to prevent.

## The checks

`npm test` is the unit suite. Everything under `scripts/qa-*.ts` is a check
that runs against a real server and a real browser — they publish fixtures,
install with the real CLI, sign in, and read the database back. They are the
only way to know the whole chain works, and each one names the failure it
exists to catch.

The maintenance jobs live beside them and are worth knowing about:

| Script | What it does |
|---|---|
| `migrate-to-neon.ts` | Copies the catalogue out of the old database and into Postgres. Safe to run again. |
| `seed-components.ts` | Writes the two reference components, and only into an empty table. |
| `clean-components.ts` | Empties the catalogue. |
| `sync-author-avatars.ts` | Puts the account's picture back on the components that were published before it had one. |
| `qa-catalogue.ts` | Every published component answers on its page, serves its document in both themes, and its registry item has files. |
| `qa-install.ts` | The real shadcn CLI installs a component and a block into a scratch project, and every import resolves. |
| `qa-publish-flow.ts` | Eight fixtures build, publish and read back; a broken import is refused with the compiler's own message. |
| `qa-payouts.ts` / `qa-payout-run.ts` | The earnings, the address review, and the weekly run — including that a creator cannot approve their own address. |
| `qa-media.ts` / `qa-video.ts` | The cover is an image, the demo loop is a video the card plays on hover, and HTML is not media. |
| `qa-sandbox-live.ts` | The sandbox boots on its own and an edit reaches the preview without a reload. |
