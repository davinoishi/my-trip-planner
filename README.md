<img src="apps/web/public/My-Trip-Planner-icon.png" alt="My Trip Planner" width="120" />

# My Trip Planner

**A self-hosted travel itinerary manager — your trips, your server, your data.**

TripIt is a great product, but it's owned by a travel agency, and every itinerary you import hands your private travel plans — flight numbers, hotel bookings, passport details — to a third party with a financial interest in your trips. My Trip Planner is a drop-in alternative you host yourself, so your travel data never leaves your own server.

> **Pre-MVP:** Core itinerary management, Gmail import, document parsing, and map view are working. Some features are still in progress — see the [feature status](#feature-status) section below.

---

## Features

### What works today
- **Trip management** — create, edit, archive, duplicate, and merge trips
- **Itinerary timeline** — 7 booking types (flights, hotels, car rentals, trains, activities, transfers, notes) with drag-to-reorder
- **Gmail import** — scans your inbox for booking confirmation emails and uses Claude AI to extract travel details automatically
- **Document upload** — upload a PDF or photo of a confirmation; Claude parses it and creates itinerary items
- **Interactive map** — Mapbox-powered map view of your trip route
- **10-day weather forecast** — shown on the itinerary for upcoming trips (Open-Meteo, no API key required)
- **Tags & search** — tag itinerary items and search across all trips
- **Travel stats** — total trips, days traveled, distance flown, countries and cities visited
- **Google sign-in** — authentication via your Google account (no passwords to manage)

### Not yet available (coming soon)
- **Trip sharing / collaboration** — invite others to view or edit a trip
- **Notifications & reminders** — alerts before upcoming trips or departures
- **Travel notes** — attach freeform notes to trips or individual items
- **Google Calendar sync** — push your itinerary to Google Calendar

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
| Reverse proxy | Caddy 2 (auto HTTPS) |
| Container runtime | Docker + Docker Compose |

---

## Deployment

### Prerequisites

- A server or VPS running Linux (1 GB RAM minimum; 2 GB recommended)
- [Docker](https://docs.docker.com/engine/install/) and [Docker Compose](https://docs.docker.com/compose/install/) installed
- A domain name pointed at your server (for HTTPS)
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

### Step 2 — Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Open `.env` and set the following:

```bash
# ─── Required ────────────────────────────────────────────────────────────────

# Generate a random secret: openssl rand -hex 32
BETTER_AUTH_SECRET=your-random-32-char-secret

# Your domain (include https:// in production)
APP_URL=https://trips.yourdomain.com
NEXT_PUBLIC_APP_URL=https://trips.yourdomain.com

# Google OAuth — see Step 3
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# Anthropic (Claude) — required for Gmail import and document parsing
ANTHROPIC_API_KEY=sk-ant-your-key

# Mapbox — required for the map view
MAPBOX_TOKEN=pk.your-mapbox-token

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

### Step 3 — Set up Google OAuth

1. Go to the [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or select an existing one)
3. Navigate to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
4. Set the application type to **Web application**
5. Add an authorized redirect URI:
   ```
   https://trips.yourdomain.com/api/auth/callback/google
   ```
6. Copy the **Client ID** and **Client Secret** into your `.env` file

> **Gmail import:** Gmail access is requested separately — only when you first use the "Scan Gmail inbox" feature. You do not need to enable the Gmail API in advance; the app will prompt for permission when needed.

---

### Step 4 — Configure Caddy for your domain

Edit `infra/Caddyfile` and replace `:80` with your domain:

```
trips.yourdomain.com {
    reverse_proxy app:3000 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }

    encode gzip

    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        Referrer-Policy strict-origin-when-cross-origin
        -Server
    }
}
```

Caddy will automatically obtain and renew a TLS certificate from Let's Encrypt.

---

### Step 5 — Start the stack

```bash
cd infra
docker compose up -d
```

This starts: PostgreSQL, PgBouncer, Redis, MinIO, ClamAV, Caddy, and the app.

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
cp .env.example apps/web/.env.local

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

## Feature status

| Feature | Status |
|---|---|
| Trip management (create / edit / delete / archive) | ✅ Available |
| 7 itinerary item types | ✅ Available |
| Drag-to-reorder items | ✅ Available |
| Gmail booking import | ✅ Available |
| Document upload & parsing | ✅ Available |
| Tags & global search | ✅ Available |
| Interactive map view | ✅ Available |
| 10-day weather forecast | ✅ Available |
| Travel stats dashboard | ✅ Available |
| Google sign-in | ✅ Available |
| Trip sharing / collaboration | 🔲 Planned |
| Notifications & reminders | 🔲 Planned |
| Travel notes | 🔲 Planned |
| Google Calendar sync | 🔲 Planned |
| Apple / Outlook Calendar sync | 🔲 Planned |

---

## License

MIT
