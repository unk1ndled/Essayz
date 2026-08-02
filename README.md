# Essayz

A private, mobile-first weekly writing circle. Members write or import Markdown during the week, explicitly submit an entry, and read everyone’s submitted work together after Sunday at 10:00 in the circle’s timezone.

## What is included

- Invite-only accounts with PBKDF2-hashed passwords and secure cookie sessions
- One Markdown draft per member per week
- Write/preview modes, a small Markdown toolbar, `.md` import, and `.md` export
- Server-enforced privacy before the reveal (other people’s Markdown never reaches the browser early)
- A guided Sunday reading batch with per-reader hearts, plus a week-by-week archive roadmap
- DST-aware weekly scheduling; no cron trigger is required
- Responsive UI and a web-app manifest for adding Essayz to a phone’s home screen
- A Cloudflare Worker, static assets, and D1 database in one deployment

## Local development with Bun

Requirements: [Bun](https://bun.sh/), Node.js 22 or newer for Cloudflare's local runtime/Wrangler, and a Cloudflare account for deployment. Bun remains the package manager and task runner; the Cloudflare tooling it launches currently relies on Node APIs.

```bash
bun install
cp .dev.vars.example .dev.vars
bun run db:migrate:local
bun run dev
```

The default local invite code comes from `.dev.vars`. Replace its example value before inviting anyone. Local D1 data lives under `.wrangler/`.

Useful checks:

```bash
bun run typecheck
bun test
bun run build
```

## Deploy to Cloudflare’s free plan

1. Authenticate Wrangler:

   ```bash
   bunx wrangler login
   ```

2. Create the D1 database:

   ```bash
   bunx wrangler d1 create essayz-db
   ```

3. Copy the returned `database_id` into `wrangler.jsonc`, replacing `REPLACE_WITH_YOUR_D1_DATABASE_ID`.

4. Apply the production migration:

   ```bash
   bun run db:migrate:remote
   ```

5. Store a long, private registration code. Share this only with members of the circle:

   ```bash
   bunx wrangler secret put INVITE_CODE
   ```

6. Deploy the Worker and frontend:

   ```bash
   bun run deploy
   ```

Wrangler prints the resulting `workers.dev` address. A custom domain can be connected later from the Cloudflare dashboard.

For subsequent deployments, run the complete verified deployment workflow:

```bash
just deploy
```

This installs the locked dependencies, runs the tests and production build, applies pending remote D1 migrations, and deploys the generated Worker and frontend assets. The migration check retries brief Cloudflare API failures up to three times, but deployment still stops if the database cannot be safely updated.

## Configuration

Non-secret settings live under `vars` in `wrangler.jsonc`:

| Setting | Default | Purpose |
| --- | --- | --- |
| `APP_TIME_ZONE` | `Europe/Paris` | IANA timezone used for week boundaries and reveal time |
| `SESSION_DAYS` | `30` | Sign-in lifetime |

The reveal is calculated on every authorized request as Sunday 10:00 in `APP_TIME_ZONE`. This avoids cron delays and correctly follows daylight-saving changes.

## Product rules in this MVP

- Each registered member can create one entry each week.
- A draft is visible only to its author.
- “Submitted” means eligible for the reveal; members can update or return it to draft until Sunday ends.
- At Sunday 10:00, submitted essays become readable by all members. Later Sunday submissions become readable immediately and remain part of that same week.
- Editing closes when the next writing week begins at local Monday midnight. Unsubmitted drafts remain private.

The schema keeps authors and weekly entries separate, so a future designated-author rotation can be added without migrating existing essays.
