# Before the Bell

Pre-IPO deal desk for family offices — beforethebell.in. Operated by SintraCap Advisors LLP.

Next.js (App Router) with a Postgres database through Drizzle ORM.

## What runs where

| Area | Path |
| --- | --- |
| Public site (anonymised deals, How it works, About, founders) | `/`, `/deals`, `/deals/[slug]`, … |
| Registration and sign-in | `/register`, `/login` |
| One NDA per company, signed on screen | `/nda/[slug]` |
| Deal room and one-page summary (needs that company's NDA) | `/room/[slug]`, `/room/[slug]/summary` |
| Office dashboard | `/dashboard` |
| Desk admin: offices and PAN checks, deals, documents, Q&A, calls, allocation requests, leads, log | `/admin` |

Deal content lives in the database and is edited in `/admin/deals`. `lib/seed.ts` holds the six deals the database is seeded with on first start.

## Deploying on Vercel

1. **Storage → Create → Neon (Postgres)**, connect it to this project. That sets `DATABASE_URL`. Tables are created and the deals seeded on first request.
2. **Settings → Environment Variables**:
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` — the first desk admin (created on start; more admins can be added in `/admin`).
   - `SESSION_SECRET` — a long random string (e.g. `openssl rand -hex 32`).
   - `NEXT_PUBLIC_SITE_URL` — optional; defaults to `https://beforethebell.in`.
   - Optional `REQUIRE_PAN_VERIFIED=1` — rooms open only after the desk marks the office's PAN verified (default: the room opens on signing; the desk checks PAN after).
3. Redeploy.

Without `DATABASE_URL` the site runs on a temporary built-in database (PGlite) and shows a warning in the admin; nothing persists.

## Local

```
npm install
npm run dev          # PGlite in .pglite/, admin@beforethebell.in / omd-local-admin
```

After changing `db/schema.ts`: `npm run db:generate` and commit the new file in `drizzle/`.

## Desk workflow and After the Bell

- **After the Bell** (`/admin/after-the-bell`): deals in companies already listed on an exchange. Desk only. They sit in the
  `deals` table with `listed = true` and are kept off every investor surface three ways: a database check
  (`deals_listed_desk_only`) refuses to publish, open or preview one; every investor-facing deals query goes through
  `lib/deal-guard.ts` (`investorWhere` / `notListed`); and `tests/listed-guard-static.test.ts` fails the build if an
  investor-side file reads `deals` without the guard. Desk pages read every deal through `lib/desk.ts`.
- **Roles**: `admin` (super admin) and `analyst`, enforced server-side in `lib/perm.ts`. Analysts run the pipeline
  (`workflow` permission: stages, owners, notes, desk files, tasks); deleting anything, settings and bulk investor import stay with a super admin.
- **Deal pipeline** (`/admin/board`): sourced → diligence → live → interest collection → term sheet/KYC → escrow/allotment → closed
  (`lib/stages.ts`). The stage is the desk's own and never changes what investors see.
- **Desk workspace** on every deal page: stage, owner, tasks, notes, internal desk files (`desk_files`, never shown to investors) and the deal's change trail.
- **Tasks** (`/admin/tasks`): per deal and/or investor, assigned to a desk member; the 9 AM cron emails each assignee their due and overdue tasks once a day.
- **Audit trail**: `audit.entity`, `entity_id` and `detail` (field → [before, after]); filter by deal or kind at `/admin/log`.
- **Investors added by the desk** (Family offices → Added by desk): by hand or CSV, stored as approved offices with `origin = 'desk'`
  and contact fields, no user account and no email sent.
- **Tests**: `npm test` (runs before every build): the listed-company leak tests, roles, CSV import, reminders and the trail.
