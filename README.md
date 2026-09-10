# CLD Portal

A retail-growth client portal for **Coffee, Lunch, Dinner** — the workspace CLD
and its clients use to see who is working which account, where each retailer
relationship stands, what has been pitched, and what happens next.

It is not a CRM and not an analytics dashboard. The spreadsheet answers *what is
recorded*; the portal is meant to answer *what does this mean, what needs
attention, and what happens next*. Product direction lives in
[`project_specs.md`](project_specs.md); design and coding rules live in
[`CLAUDE.md`](CLAUDE.md).

---

## Architecture

```
read    Page  ->  Component  ->  Selector       ->  Workspace snapshot  ->  Postgres
write   Page  ->  Form       ->  Server action  ->  Mutation layer      ->  Postgres
files   Form  ->  Server action  ->  Supabase Storage   (Postgres stores the path)
```

**Next.js 16 App Router** on React 19, TypeScript, Tailwind v4. Server components
throughout; the client boundary is used only where something genuinely needs
local state.

- **Database-first, with no static fallback.** Every screen reads from Postgres.
  Without `DATABASE_URL` the portal refuses to render rather than quietly serve
  stale or hard-coded data. `src/data/` remains in the repo only as the
  comparison baseline for the original prototype — nothing imports it at runtime.
- **Selectors are the only data-access boundary.** No page and no component runs
  a query. `loadWorkspace()` reads the whole client workspace in one pass and is
  memoised **per request** with React's `cache()`, so a save is visible on the
  very next render and nothing leaks into the next request.
- **`pg` directly, not an ORM and not `supabase-js`.** The connection is
  server-side only, behind `server-only`. The browser never receives a database
  credential of any kind.
- **Images split by role.** Supabase Storage holds the bytes; Postgres holds the
  business record and a *path* — never a URL, never binary. Uploads are
  server-mediated and validated from the file's own magic bytes.
- **Access is gated at the perimeter and again at every mutation.** See
  [Authentication](#authentication).

Deeper notes on the data layer, the migrations and the write paths:
[`supabase/README.md`](supabase/README.md).

---

## Local development

Requires **Node 24+**.

```bash
npm install
cp .env.example .env.local      # then fill it in — see below
npm run dev                     # http://localhost:3000
```

`dev` and `build` both pin `--webpack`. That is deliberate: Windows Application
Control on the development machine blocks Next's native SWC binary, and
Turbopack has no WebAssembly fallback. Nothing needs to be typed on the command
line, and `npm start` is unchanged.

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and serve |
| `npm run typecheck` / `npm run lint` | TypeScript, ESLint |
| `npm run db:connect` | Prove the database connection, printing no credential |
| `npm run db:status` / `db:migrate` | Which migrations are applied / apply the pending ones |
| `npm run db:state` | What the database currently holds |
| `npm run db:schema:verify` | Compare the live schema against the recorded census |
| `npm run db:storage` | What the Storage bucket is and what is in it (`-- --apply` creates it) |
| `npm run db:refresh-check` | Create / edit / archive through the real UI, then clean up |
| `npm run db:media` | Upload / replace / remove an image through the real UI |
| `npm run clean:cache` | Remove `.next/cache`, which records build-time environment |

The `db:*` suites that drive the UI need the app running and Chrome installed;
they sign in through the real form, so `CLD_PORTAL_PASSWORD` must be set.

---

## Environment variables

Copy [`.env.example`](.env.example) to `.env.local` — which is gitignored, and
must stay that way. **Every one of these is a credential.**

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Supabase Postgres, session-mode pooler. Read only in `src/lib/db/pool.ts` |
| `SUPABASE_SECRET_KEY` | for uploads | Supabase Storage writes. Server-only. Reading public images does not need it |
| `CLD_PORTAL_PASSWORD` | yes | The passphrase for `/login` |
| `CLD_SESSION_SECRET` | yes | Signs the session cookie. 32+ random characters |
| `SUPABASE_URL` | no | Derived from `DATABASE_URL` unless self-hosted or proxied |

`SUPABASE_SERVICE_ROLE_KEY` is **not** used by application code. If it is still
in your `.env.local`, it can be removed.

Generate a session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

---

## Database and migrations

Eleven forward migrations in [`supabase/migrations/`](supabase/migrations/),
each with a matching rollback in `supabase/down/`. Each applies in its own
transaction and rolls back whole on failure.

```bash
npm run db:status      # what is applied
npm run db:migrate     # apply what is pending
npm run db:rollback    # step one back
```

Two things worth knowing:

- **No seed or import ever runs automatically.** There is no `postinstall`,
  `prebuild` or `prepare` hook. Nothing touches data unless you run it yourself.
- **No migration destroys operational data.** There is no `TRUNCATE`, no
  `DROP TABLE`, no unqualified `DELETE`. The one column drop —
  `products.image_url` in `0011` — refuses to run and raises instead if any row
  still holds a value.

`npm run db:serve` runs PGlite behind the real Postgres wire protocol, so a
throwaway local database can be driven through the same `pg` code path as
Supabase. The SQL is not PGlite-specific.

---

## Authentication

The portal is closed. A visitor signs in at `/login` with a shared passphrase
and receives a signed, expiring, `HttpOnly` session cookie.

Protection is in two independent layers, and both must fail for anything to get
through:

1. **`src/proxy.ts`** — Next 16's renamed middleware — turns away every request
   that has no valid session before a page renders, a server action runs, or
   the database is touched. A POST carrying the `next-action` header is answered `401` rather than
   redirected, so a scripted request straight at a server action gets nowhere.
2. **Every server action calls `requireSession()` first.** A server action is a
   POST endpoint in its own right, reachable whether or not a page ever rendered
   a form pointing at it, so each one establishes for itself that somebody is
   signed in.

Nothing about this is decided in the browser. The passphrase is compared on the
server in constant time, and the cookie is signed with `CLD_SESSION_SECRET` and
verified with a constant-time HMAC check. If either variable is missing the
portal **refuses every visitor** — the correct direction to fail, given the
alternative is an open door onto a live database.

**What this is, and what it is not.** It is a single shared passphrase for a
single-client workspace. It is the right size for this phase and it genuinely
protects the server. It is **not** per-user identity: there are no accounts, no
per-user permissions and no audit trail of who changed what. If CLD later needs
to know which client user did something, that is Supabase Auth (or similar) plus
a user column on the tables — a different and larger change.

There is still **no row-level security on the application's own tables**, and
none is needed while the only path to them is a server-side pool behind this
gate. RLS *is* enabled on `storage.objects` with no policies, so the anon and
authenticated roles can write nothing to the bucket; every upload goes through
the server.

---

## Deploying

Vercel, with the repository connected.

1. **Set every required variable in the Vercel project**, for Production *and*
   Preview. `.env.local` is not deployed.
2. **`DATABASE_URL` must be present at build time, not only at runtime.** Four
   routes are prerendered with `generateStaticParams`, which queries the
   database while the build runs. Without it the build fails.
3. Use a **different `CLD_PORTAL_PASSWORD` from the local one**, and a session
   secret generated for that environment.
4. Preview deployments point at the same database unless you give them their
   own. Decide that deliberately.
5. `npm run db:migrate` is **not** run by the deploy. Apply migrations yourself,
   before deploying the code that expects them.

---

## Security

**Never commit a secret.** `.gitignore` excludes `.env*`, with a single
exception for `.env.example`, which contains variable names and placeholders
only.

- No credential is read anywhere but a `server-only` module.
- There is no `NEXT_PUBLIC_` variable in this project, and none of these values
  may ever be given that prefix — it compiles them into the browser bundle.
- `SUPABASE_SECRET_KEY` bypasses every row-level policy in the project. It is
  read on the server, in `src/lib/storage/assets.ts`, and is in no client bundle.
- **`.next/cache` records the environment a build ran with**, so the connection
  string sits in a cache file on disk after a build. It is gitignored and cannot
  be committed, but it travels with a copy of the project folder. Run
  `npm run clean:cache` before zipping or sharing this directory.
- If a credential is ever printed, pasted or committed, **rotate it** rather
  than deleting the evidence.
