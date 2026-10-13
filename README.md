# Off Market Desk

Pre-IPO deal desk for family offices — offmarketdesk.in. Operated by SintraCap Advisors LLP.

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
   - `NEXT_PUBLIC_SITE_URL` — `https://offmarketdesk.in` once the domain points here.
   - Optional `REQUIRE_PAN_VERIFIED=1` — rooms open only after the desk marks the office's PAN verified (default: the room opens on signing; the desk checks PAN after).
3. Redeploy.

Without `DATABASE_URL` the site runs on a temporary built-in database (PGlite) and shows a warning in the admin; nothing persists.

## Local

```
npm install
npm run dev          # PGlite in .pglite/, admin@offmarketdesk.in / omd-local-admin
```

After changing `db/schema.ts`: `npm run db:generate` and commit the new file in `drizzle/`.
