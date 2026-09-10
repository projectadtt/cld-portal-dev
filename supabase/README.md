# CLD portal — database layer

The portal reads all of its data from Postgres, and writes two kinds of
record back.
**There is no static fallback.**
Without `DATABASE_URL` every route fails, deliberately: a portal that quietly
served stale or hard-coded data would be worse than one that stops.

`src/data/` is still in the repo, untouched, as the comparison baseline. Nothing
in the application imports it at runtime any more — only its type declarations.

## Architecture

```
read    Page  ->  Component  ->  Selector       ->  Workspace snapshot  ->  Postgres
write   Page  ->  Form       ->  Server action  ->  Mutation layer      ->  Postgres
```

- **Selectors are the only data-access boundary.** No page and no component
  runs a query; `src/lib/db` is imported by the selector layer and by each
  route's own `loadWorkspace()` call, and nothing else.
- **One snapshot, fifteen queries.** `loadWorkspace()` reads the whole client
  workspace — one query per table, none per row — and every selector then
  derives from it in memory. That is why no screen can produce an N+1
  regardless of how many rows it renders.
- **Each route loads for itself.** Next renders the layout and the page in
  parallel, so a page cannot rely on the layout's await having finished.
  `loadWorkspace()` is memoised **per request**, via React's `cache()`, so the
  layout, the page and `generateMetadata` share one load and nothing survives
  into the next request. It used to be memoised for the life of the process,
  and that was the bug behind "saved, but the page still shows the old data":
  revalidation re-rendered, and the re-render read the same stale snapshot.
- **Derivation is unchanged.** The 88 selectors kept their names, signatures
  and logic; only the source of the base arrays moved.

## Running it

```bash
npm run db:serve                        # local Postgres on the wire protocol
DATABASE_URL=... npm run dev            # or build / start

npm run db:migrate                      # apply pending migrations
npm run db:seed                         # seed 7Grains from src/data (idempotent)
npm run db:reset                        # down, up, seed, validate
npm run db:verify                       # validate + compare + traceability
npm run db:write                        # the write path, driven through the UI
```

| Command | What it proves |
| --- | --- |
| `db:validate` | The database holds the same records as `src/data`, field by field |
| `db:compare` | Every selector returns the same output from Postgres as from `src/data` |
| `db:trace` | One chain resolves end to end through real foreign keys, and shows up on every screen |
| `db:write` | A record can be edited through the portal, lands in Postgres, reaches every dependent screen, and history survives it |
| `write/responsive.mjs` | No page scrolls sideways at 390, 768, 1024 or 1440 |

`db:write` needs the application running (`npm start`) and Chrome, because it
drives the real form rather than calling the mutation directly. It restores
everything it changes — but its last suite tidies up with direct DELETEs, so
restart the application afterwards: only a write through the mutation layer
drops the in-process snapshot.

**One writer at a time.** The local database is a file-backed PGlite directory.
`db:serve` holds it open, so a seed run directly against the file while the
server is up leaves the two views diverged. Either seed through the server
(`DATABASE_URL=... npm run db:seed`) or restart the server afterwards.

## Where the data goes

| `DATABASE_URL` | Backend |
| --- | --- |
| set | that Postgres, via `pg`. This is the Supabase path |
| unset | nothing — the application refuses to start a render |

`db:serve` runs PGlite behind the Postgres wire protocol, so the application
uses the real `pg` driver against a real `DATABASE_URL` exactly as it will
against Supabase. **The SQL is not PGlite-specific** and the application has
one code path; only the endpoint differs.

## Migrations

| File | Contents |
| --- | --- |
| `0001_lookups.sql` | 18 status lookup tables. First, because nine tables reference them |
| `0002_core.sql` | `clients`, `brokers`, `retailers`, `products` |
| `0003_relationships.sql` | `contacts`, `workstream_items` |
| `0004_engagement.sql` | `meetings`, `meeting_attendees`, `samples`, `buyer_feedback` |
| `0005_work.sql` | `actions`, `activities` |
| `0006_opportunities.sql` | `opportunities` + 2 join tables |
| `0007_history_rules.sql` | Append-only enforcement on `buyer_feedback` and `activities` |
| `0008_standing_p0_1.sql` | `retailers.standing` — **isolated so P0-1 stays reversible** |
| `0009_planning_fields.sql` | Forward-looking meeting state and planning text — see below |
| `0010_display_order.sql` | Curated row order, which a table has no inherent notion of |

Each has a matching file in `down/`. Every migration applies in its own
transaction; a failure rolls back whole.

## The write paths

`src/lib/db/mutations.ts` is the entire surface that can change the database.
Two functions, each reached only through a server action:

| Function | Screen | What it can change |
| --- | --- | --- |
| `saveWorkstreamItem` | `/retailers/[id]/items/[itemId]` | item status, sample, next step, the tracked action's state, new buyer feedback |
| `saveAction` | `/actions/[actionId]` | status, due date, owner |

Both run in a single transaction, validate every value against the lookup
tables rather than against a TypeScript constant, and drop the workspace
snapshot after the commit.

`saveAction` cannot move work between accounts: `retailer_id`, `product_id`,
`workstream_item_id`, `meeting_id` and `label` are not in its input shape at
all, so a crafted form has nowhere to put them. The one relationship it can
change — the owner — is checked against `brokers` scoped to the current client.

Four rules they keep, each of which the schema had already promised:

- **Feedback is only ever inserted.** A new record, never a substitution; the
  append-only trigger would refuse anything else, and this path never asks.
- **A second sample round is a second row.** Correcting a status updates the
  row the portal is showing; asking for more samples opens a new one.
- **An action is created only where none exists.** Editing one never makes a
  second, and `ws-01 -> act-01, act-02` survives every write.
- **`Done` stamps `completed_at`; leaving Done clears it** — the rule 0005
  deliberately left to the write path, written once in `completedAtRule` and
  used by both functions so they cannot disagree. act-01 was already Done with
  no recorded time, and nothing here fills that in.

No lifecycle date is ever stamped by a status change. A status can be
corrected long after the fact, so a date written then would be a guess.

## What is deliberately not here

- **No CRUD beyond those two paths.** No product, retailer, broker, meeting,
  contact or opportunity writes. No delete or archive UI. No action can be
  created from the Actions screen — only from the item that needs it.
- **No field-level audit log.** Changing an item status overwrites it, and
  nothing records what it was. `activities` is the intended home for that and
  is not written by this path — inventing an audit trail was the alternative.
- **No authentication and no RLS policies.**
- **No `sample_events` table** — `samples` carries five nullable lifecycle
  dates, because each step happens at most once per sample.
- **No `priority` column on actions.**
- **No personal data.** `contacts.email` and `.phone` are null on every row.

## Two values the portal now shows differently

Both are corrections, both are visible, and neither was decided quietly.

**S&R's account-level sample status** now reads `Reviewed - positive` instead
of `Received`. The stored roll-up disagreed with its own item `ws-08`; the
database derives the field, so the two can no longer drift apart.

**`Meeting.actions`** — the free-text array is gone. A meeting's follow-through
is now real action rows with owners, due dates and completion state. Nothing in
the UI read the prose array.

## Open decisions

**P0-1 — one status field or two.** `0008` adds `standing` as its own
migration. Every seeded retailer is `Active`, so no row encodes the decision.

**P0-3 — contact identity and visibility.** `contacts` holds each retailer's
source string verbatim in `name`; `title`, `email` and `phone` are null, and no
visibility policy is implemented.

**One word of terminology.** The workbook says `Reached out - waiting on
response`; the portal has always displayed `waiting for response`. The value is
translated at the boundary in `src/lib/db/workspace.ts` rather than either side
being changed quietly, because it shows on screen. Whichever way CLD decides it
is a one-line change, and the map is the only place the two vocabularies meet.

## Where the credential can end up

`DATABASE_URL` lives in `.env.local`, which `.gitignore` covers with `.env*`.
The application reads it in exactly one place, `src/lib/db/pool.ts`, behind
`server-only`; the scripts read it through `scripts/db/env.mjs`. It is in no
browser bundle and no source file.

One place it does land, which is worth knowing: **Turbopack records the
environment it built with in `.next/cache`**, so after a build the password sits
in a cache file on disk. `.next/` is gitignored, so it cannot be committed, but
it would travel with a copy of the project directory.

    npm run clean:cache

removes it. Worth running before zipping, copying or sharing this folder.

## Images: what is stored where

    Supabase Storage    the bytes
    Postgres            the business record, and the path back to the bytes

`products`, `brokers` and `retailers` each carry an `image_path`. It is a path
inside the `cld-assets` bucket and never a URL — see the commentary at the top
of `migrations/0011_media.sql` for why. Every URL the portal renders is built
from that path at render time, in `src/lib/storage/assets.ts`.

Each table's path is pinned to its own folder by a check constraint, so a
product row cannot come to hold a broker's photograph, and no path can express
a `..`, a leading slash, a second extension or a caller-chosen filename. Object
names are 32 random hex characters.

    npm run db:storage              what the bucket is and what it holds
    npm run db:storage -- --apply   create or correct it
    npm run db:media                drive upload / replace / remove through the UI

`db:storage` also lists objects that no row references. That should always be
empty: an upload writes the bytes first and the row second, and the object a
row used to point at is deleted only after the new row has committed. The
failure that ordering rules out is a row pointing at a file that is not there.

## Development-only assumptions

These are true of this phase and should be revisited before anything is
described as production-secure.

**There is no authentication and no RLS on the application's own tables.**
Anyone who can reach the portal can write to it. That has been true since the
first write path and is not changed by images.

**The bucket is public-read.** Anyone holding an object's URL can fetch it,
without signing in. Object names are random, so a URL cannot be guessed from a
product name, but that is obscurity and not access control. The alternative,
signed URLs, expires — and a page that was correct when it was rendered would
start showing broken images. If broker portraits or anything else in the bucket
later needs to be genuinely private, that is the trade to revisit.

**Writes are server-mediated.** RLS is enabled on `storage.objects` with no
policies, so the anon and authenticated roles can write nothing. Uploads work
only through `SUPABASE_SECRET_KEY`, which is read on the server, in a
`server-only` module, and is in no browser bundle. It must never be given a
`NEXT_PUBLIC_` prefix.

**Uploads are validated from the file's own bytes**, not from the content type
the browser claims — an SVG renamed `.jpg` is refused. The bucket independently
declares the same 5 MB limit and the same three MIME types, so neither check is
relied on alone.

## Two bundlers, and why this project pins one

Windows Application Control on the development machine blocks Next's native
binary, `@next/swc-win32-x64-msvc`. Turbopack has no WebAssembly fallback and
refuses to start without it, so `dev` and `build` in package.json both pass
`--webpack`; nothing needs to be typed on the command line, and `npm start` is
unchanged. Nothing here works around the block — webpack uses the WASM compiler
that ships alongside, and the only real cost is compile speed.

## `allowedDevOrigins`, and a wrong diagnosis worth recording

For a while this file claimed that React did not hydrate under `next dev` and
blamed the WASM fallback. **That was wrong**, and the way it was wrong is worth
keeping, because the same mistake is easy to make again.

The actual cause: the dev server announces itself as `localhost`, and Next
blocks requests to its `/_next/*` **dev** endpoints from any other host. That
protection is sound — a page in another tab should not be able to reach a dev
server running on your machine — but `127.0.0.1` is a *different host name* for
the same machine, so opening the portal at `http://127.0.0.1:3000` tripped it.
The casualty was the HMR WebSocket: refused, so the dev client never finished
starting, so **React never hydrated**. The page rendered perfectly and nothing
on it responded to a click.

`allowedDevOrigins: ["127.0.0.1"]` in `next.config.ts` is the whole fix, and it
touches development only.

Two things made this look like a compiler problem rather than a host-name one:

- The dev server had been printing the reason all along —
  `⚠ Blocked cross-origin request to Next.js dev resource /_next/hmr from
  "127.0.0.1"` — but a log search for `error|failed|⨯` does not match a line
  that begins `⚠ Blocked`.
- Reading `<script src>` out of the DOM suggested the route's client chunk was
  never requested. It was: webpack's own loader fetches it, so it never appears
  as a tag. Recording the actual network traffic showed it arriving with a 200.

The lesson for next time: read what the server said, and record requests rather
than inferring them from markup.
