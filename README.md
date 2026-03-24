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
git clone https://github.com/davinoishi/my-trip-planner.git
cd my-trip-planner
```

---

### Step 2 — Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Open `.env` and set the following (you will fill in the noBGP URL and Google OAuth credentials in the next two steps):

```bash
# ─── Required ────────────────────────────────────────────────────────────────

# Generate a random secret: openssl rand -hex 32
BETTER_AUTH_SECRET=your-random-32-char-secret

# Your noBGP public URL — set this after Step 3
APP_URL=https://yourapp.nobgp.com
NEXT_PUBLIC_APP_URL=https://yourapp.nobgp.com

# Google OAuth — set this after Step 4
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

### Step 3 — Start the stack

**x86_64 (Intel/AMD) — includes ClamAV virus scanning:**
```bash
cd infra
docker compose --profile scanning up -d
```

**ARM64 (Raspberry Pi, Apple Silicon) — ClamAV has no ARM64 image:**
```bash
cd infra
CLAMAV_REQUIRED=false docker compose up -d
```

This starts: PostgreSQL, Redis, MinIO, and the app on port 3000. On x86_64 with `--profile scanning`, ClamAV is also started.

> **First boot with ClamAV:** ClamAV downloads its virus signature database on startup. This takes 2–5 minutes. Uploads may be blocked until it's ready if `CLAMAV_REQUIRED=true`.

Check that everything is running:

```bash
docker compose ps
docker compose logs app --tail 50
```

---

### Step 4 — Publish via noBGP to get your public URL

noBGP creates an HTTPS tunnel to your app and gives you a public URL that Google OAuth can use as a redirect URI. See the [noBGP proxy CLI reference](https://docs.nobgp.com/cli-reference#nobgp-proxy) for full options.

```bash
nobgp proxy publish --proxy-url http://localhost:3000 --title "My Trip Planner"
```

Note the public URL — it will look like `https://yourapp.nobgp.com`.

> **Using Claude with the noBGP MCP server?** If you have the noBGP MCP server connected to Claude Code, you can simply ask: *"Publish a proxy for my Trip Planner app running on port 3000"* and Claude will run the command for you.

> **Private proxy:** noBGP supports both public and private proxies. Either works — Google OAuth only requires a valid HTTPS URL with a real domain, which noBGP provides.

Once you have the URL, update your `.env` file:

```bash
APP_URL=https://yourapp.nobgp.com
NEXT_PUBLIC_APP_URL=https://yourapp.nobgp.com
```

Then restart the app to pick up the new URL:

```bash
docker compose restart app
```

---

### Step 5 — Set up Google OAuth

> **Note:** My Trip Planner uses **Google sign-in only** — there are no username/password accounts.

1. Go to the [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or select an existing one)
3. Navigate to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
4. Set the application type to **Web application**
5. Add your noBGP URL as an authorized redirect URI:
   ```
   https://yourapp.nobgp.com/api/auth/callback/google
   ```
6. Copy the **Client ID** and **Client Secret** into your `.env` file, then restart the app:
   ```bash
   docker compose restart app
   ```

> **Gmail import:** Gmail access is requested separately — only when you first use the "Scan Gmail inbox" feature. You do not need to enable the Gmail API in advance; the app will prompt for permission when needed.

---

### Step 6 — Open the app and sign in

Navigate to your noBGP URL:

```
https://yourapp.nobgp.com
```

Click **Sign in with Google** and log in with your Google account. The first user to sign in becomes the owner of that account — no additional setup required.

Share the URL with anyone you want to invite; they sign in with their own Google account and you can grant them access to trips from the Settings page.

---

### Updating to a new version

```bash
git pull
cd infra
docker compose build app
docker compose up -d app
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

# Run database migrations (first time only)
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
