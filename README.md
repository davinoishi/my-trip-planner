<img src="apps/web/public/My-Trip-Planner-icon.png" alt="My Trip Planner" width="120" />

# My Trip Planner

**A self-hosted travel itinerary manager — your trips, your server, your data.**

TripIt is a great product, but it's owned by a travel agency, and every itinerary you import hands your private travel plans — flight numbers, hotel bookings, passport details — to a third party with a financial interest in your trips. My Trip Planner is a drop-in alternative you host yourself, so your travel data never leaves your own server.

---

## Features

- **Trip management** — create, edit, archive, duplicate, and merge trips
- **Itinerary timeline** — 7 booking types (flights, hotels, car rentals, trains, activities, transfers, notes) with drag-to-reorder; multi-day flights and hotel stays show as Depart/Arrive and Check-in/Check-out entries on the correct days
- **Gmail import** — scans your inbox for booking confirmation emails and uses Claude AI to extract travel details automatically
- **Document upload** — upload a PDF or photo of a confirmation; Claude parses it and creates itinerary items
- **Interactive map** — Mapbox-powered map view of your trip route
- **10-day weather forecast** — shown on the itinerary for upcoming trips (Open-Meteo, no API key required)
- **Tags & search** — tag itinerary items and search across all trips
- **Travel stats** — total trips, days traveled, distance flown, countries and cities visited
- **iCal calendar feed** — subscribe to your trip itinerary from any calendar app (Google Calendar, Apple Calendar, Outlook, etc.) using a private token-based feed URL
- **Trip sharing** — share trips with others by email; viewer or editor roles; account-level or per-trip
- **Trip notes** — freeform notes per trip with auto-save
- **Mobile-optimized UI** — responsive layout with bottom navigation for phones and tablets
- **Google sign-in** — authentication via your Google account (no passwords to manage)

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), Tailwind CSS, Mapbox GL |
| API | tRPC v11 |
| Database | PostgreSQL 16 + Drizzle ORM |
| Auth | Better Auth (Google OAuth) |
| Storage | MinIO (S3-compatible) |
| Cache / rate limiting | Redis 7 |
| AI parsing | Anthropic Claude API |
| Virus scanning | ClamAV |
| HTTP proxy | noBGP (public or private HTTPS tunnel) |
| Container runtime | Docker + Docker Compose |

---

## Deployment

### Prerequisites

- A machine running Linux with [Docker](https://docs.docker.com/engine/install/) and [Docker Compose](https://docs.docker.com/compose/install/) installed (1 GB RAM minimum; 2 GB recommended)
- A [noBGP](https://nobgp.com) account for HTTPS access (free tier available)
- A [Google Cloud](https://console.cloud.google.com) project with OAuth credentials
- An [Anthropic API key](https://console.anthropic.com) (Claude — used for email/document parsing)
- A [Mapbox token](https://account.mapbox.com) (free tier is sufficient)

---

### Step 1 — Clone the repository

```bash
git clone https://github.com/your-username/my-trip-planner.git
cd my-trip-planner
```

---

### Step 2 — Publish via noBGP to get your public URL

noBGP creates an HTTPS tunnel to your local app. You'll need this URL before configuring Google OAuth.

1. Install the noBGP client and log in
2. Publish your app on port 3000:
   ```bash
   nobgp publish --port 3000
   ```
3. Note the public URL you receive — it will look like `https://yourapp.nobgp.com` (or a custom domain if you've configured one)

> **Private proxy:** noBGP also supports private proxies if you don't want the URL to be publicly listed. Either way, Google OAuth requires a valid HTTPS URL with a public domain — noBGP provides this.

---

### Step 3 — Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Open `.env` and set the following:

```bash
# ─── Required ────────────────────────────────────────────────────────────────

# Generate a random secret: openssl rand -hex 32
BETTER_AUTH_SECRET=your-random-32-char-secret

# Your noBGP public URL (from Step 2)
APP_URL=https://yourapp.nobgp.com
NEXT_PUBLIC_APP_URL=https://yourapp.nobgp.com

# Google OAuth — see Step 4
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# Anthropic (Claude) — required for Gmail import and document parsing
ANTHROPIC_API_KEY=sk-ant-your-key

# Mapbox — required for the map view
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your-mapbox-token

# ─── Database & services (change these passwords) ─────────────────────────────
POSTGRES_PASSWORD=change-me-strong-password
REDIS_PASSWORD=change-me-strong-password
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=change-me-strong-password

# ─── Optional: fail-closed virus scanning in production ──────────────────────
# When set to true, file uploads are blocked if ClamAV is unavailable.
# Recommended for production.
CLAMAV_REQUIRED=true
```

---

### Step 4 — Set up Google OAuth

1. Go to the [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or select an existing one)
3. Navigate to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
4. Set the application type to **Web application**
5. Add your noBGP URL as an authorized redirect URI:
   ```
   https://yourapp.nobgp.com/api/auth/callback/google
   ```
6. Copy the **Client ID** and **Client Secret** into your `.env` file

> **Gmail import:** Gmail access is requested separately — only when you first use the "Scan Gmail inbox" feature. You do not need to enable the Gmail API in advance; the app will prompt for permission when needed.

---

### Step 5 — Start the stack

```bash
cd infra
docker compose up -d
```

This starts: PostgreSQL, PgBouncer, Redis, MinIO, ClamAV, and the app.

> **First boot:** ClamAV downloads its virus signature database on startup. This takes 2–5 minutes. Uploads may be blocked until it's ready if `CLAMAV_REQUIRED=true`.

Check that everything is running:

```bash
docker compose ps
docker compose logs app --tail 50
```

---

### Step 6 — Run database migrations

```bash
docker compose exec app node -e "
  const { drizzle } = require('drizzle-orm/node-postgres');
  const { Pool } = require('pg');
  const { migrate } = require('drizzle-orm/node-postgres/migrator');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
  migrate(db, { migrationsFolder: '/app/packages/db/src/migrations' })
    .then(() => { console.log('Migrations applied'); pool.end(); })
    .catch(e => { console.error(e); process.exit(1); });
"
```

Or from your host machine with `DATABASE_URL` set:

```bash
pnpm --filter @trip/db exec drizzle-kit migrate
```

---

### Updating to a new version

```bash
git pull
cd infra
docker compose build app
docker compose up -d app
# Then re-run migrations if needed
```

---

## Local development

Start the backing services only (no app container):

```bash
cd infra
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

Then in another terminal, from the repo root:

```bash
# Install dependencies
pnpm install

# Copy env and fill in your values
cp .env.example .env

# Run database migrations
DATABASE_URL=postgresql://tripit:tripit_dev_password@localhost:5432/tripit \
  pnpm --filter @trip/db exec drizzle-kit migrate

# Start the dev server
pnpm dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

### Local service ports

| Service | Port | Notes |
|---|---|---|
| Next.js app | 3000 | Dev server |
| PostgreSQL | 5432 | Direct connection |
| Redis | 6379 | Rate limiting |
| MinIO API | 9000 | S3-compatible storage |
| MinIO Console | 9001 | Browser UI at http://localhost:9001 |
| ClamAV | 3310 | Virus scanner (optional in dev) |

---

## Privacy & security

- All trip data is stored in your own PostgreSQL database
- Uploaded documents are stored in your own MinIO instance — nothing is sent to external storage
- Gmail access is opt-in and scoped to read-only; it is requested only when you use the import feature
- Files are scanned for malware via ClamAV before storage
- File type is validated against magic bytes (not just the extension or MIME header)
- Rate limiting is applied to all mutating endpoints via Redis
- Audit logs record sensitive actions (trip deletions, document uploads, merges)

---

## Roadmap

Later:
- [ ] Gmail import creates duplicates (forwarded email). Gracefully handle duplicate data from imports.
- [ ] Email forward solution (instead of a sync and read all the emails). Forward information to a fixed trip@domain.com
- [ ] Notifications: alert before upcoming trips / departures
- [ ] Offline access, Mobile App

---

## License

MIT
