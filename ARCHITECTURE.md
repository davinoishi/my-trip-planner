# Architecture Overview — My Trip Planner

## Tech Stack at a Glance

| Layer | Technology |
|---|---|
| Monorepo | Turborepo + pnpm workspaces |
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS |
| API | tRPC v11 (end-to-end type-safe) |
| Database | PostgreSQL 16 + Drizzle ORM |
| Auth | Better Auth (Google OAuth) |
| Storage | MinIO (S3-compatible, self-hosted) |
| AI | Anthropic Claude (document + email parsing) |
| Maps | Mapbox GL JS |
| Weather | Open-Meteo (free, no key required) |
| Email Import | Gmail API |
| Virus Scan | ClamAV |
| Cache / Session | Redis |

---

## Repository Structure

```
tripit/                          ← Turborepo root
├── apps/
│   └── web/                     ← Next.js 15 application
│       ├── src/
│       │   ├── app/             ← App Router pages & API routes
│       │   │   ├── (app)/       ← Authenticated layout group
│       │   │   │   ├── trips/   ← Trip list + per-trip tabs
│       │   │   │   ├── search/  ← Global item search
│       │   │   │   ├── stats/   ← Travel statistics
│       │   │   │   ├── import/  ← Gmail import UI
│       │   │   │   └── settings/← Calendar URL + preferences
│       │   │   ├── (auth)/      ← Login page
│       │   │   └── api/         ← Next.js route handlers
│       │   │       ├── trpc/    ← tRPC HTTP adapter
│       │   │       ├── auth/    ← Better Auth handler
│       │   │       ├── upload/  ← Document upload endpoint
│       │   │       ├── calendar/← Public iCal feed
│       │   │       ├── stats/   ← Travel stats endpoint
│       │   │       └── trips/[tripId]/
│       │   │           ├── weather/  ← Historical weather
│       │   │           └── forecast/ ← 10-day forecast
│       │   ├── components/      ← Shared React components
│       │   └── lib/             ← Client utilities + airports data
│       └── public/
│
├── packages/
│   ├── api/                     ← tRPC router + business logic
│   │   └── src/
│   │       ├── routers/         ← trips, itinerary-items, tags,
│   │       │                       packing-list, users, imports, documents
│   │       └── lib/             ← booking-parser, trip-matcher,
│   │                               booking-to-items, storage, gmail
│   ├── db/                      ← Drizzle ORM schema + migrations
│   │   └── src/
│   │       ├── schema/          ← users, trips, itinerary-items,
│   │       │                       documents, packing-items, tags
│   │       └── migrations/      ← SQL migration files
│   └── shared/                  ← Zod schemas + TypeScript types
│                                   shared between app and API
│
└── scripts/
    └── generate-airports.mjs    ← Regenerates airports.ts from OurAirports
```

---

## System Architecture Diagram

```mermaid
graph TB
    subgraph Browser["Browser (Next.js Client)"]
        UI["React UI\n(App Router + Tailwind)"]
        tRPCClient["tRPC Client\n(type-safe queries)"]
        MapboxGL["Mapbox GL JS\n(interactive map)"]
    end

    subgraph NextJS["Next.js Server (apps/web)"]
        AppRouter["App Router\nServer Components"]
        APIRoutes["API Route Handlers\n/api/*"]
        tRPCServer["tRPC HTTP Adapter\n/api/trpc"]
        AuthHandler["Better Auth\n/api/auth"]
    end

    subgraph APIPackage["@trip/api — Business Logic"]
        Routers["tRPC Routers\ntrips · items · tags\npacking · users · imports"]
        BookingParser["Booking Parser\n(Claude AI)"]
        TripMatcher["Trip Matcher\n(date-range grouping)"]
        Storage["Storage Layer\n(MinIO S3)"]
        GmailClient["Gmail Client\n(email import)"]
    end

    subgraph DBPackage["@trip/db — Data Layer"]
        DrizzleORM["Drizzle ORM"]
        Schema["Schema\nusers · trips · items\ndocuments · packing · tags"]
        Migrations["SQL Migrations"]
    end

    subgraph Infrastructure["Infrastructure (self-hosted)"]
        Postgres["PostgreSQL 16"]
        Redis["Redis\n(sessions)"]
        MinIO["MinIO\n(S3-compatible\ndocument storage)"]
        ClamAV["ClamAV\n(virus scanning)"]
    end

    subgraph External["External Services"]
        Claude["Anthropic Claude API\n(document + email parsing)"]
        GoogleOAuth["Google OAuth\n(authentication)"]
        GmailAPI["Gmail API\n(email booking import)"]
        OpenMeteo["Open-Meteo\n(weather + forecast)"]
        MapboxAPI["Mapbox API\n(map tiles + geocoding)"]
        OurAirports["OurAirports\n(IATA → coords + country)"]
    end

    UI --> tRPCClient
    tRPCClient --> tRPCServer
    UI --> MapboxGL
    MapboxGL --> MapboxAPI
    AppRouter --> APIRoutes

    tRPCServer --> Routers
    APIRoutes --> BookingParser
    APIRoutes --> Storage
    APIRoutes --> GmailClient

    Routers --> DrizzleORM
    BookingParser --> Claude
    GmailClient --> GmailAPI
    Storage --> MinIO
    Storage --> ClamAV

    DrizzleORM --> Postgres
    AuthHandler --> Redis
    AuthHandler --> GoogleOAuth

    APIRoutes -- "weather/forecast" --> OpenMeteo
    APIRoutes -- "iCal feed" --> tRPCClient

    OurAirports -. "build-time script" .-> Schema
```

---

## Data Flow: Document Import

```mermaid
sequenceDiagram
    participant User
    participant Web as Next.js Web
    participant Store as MinIO Storage
    participant AV as ClamAV
    participant AI as Claude AI
    participant DB as PostgreSQL

    User->>Web: Upload PDF / image
    Web->>AV: Virus scan buffer
    AV-->>Web: Clean ✓
    Web->>Store: Store file → returns key
    Web->>DB: Insert documents record
    Web->>AI: Parse booking (PDF text / image)
    AI-->>Web: Structured booking JSON
    Web->>DB: Find or create trip (date-range match)
    Web->>DB: Insert itinerary_items (isDraft=1)
    Web-->>User: "Review your bookings" prompt
    User->>Web: Approve / edit / reject drafts
    Web->>DB: Set isDraft=0 (confirmed)
```

---

## Data Flow: Gmail Email Import

```mermaid
sequenceDiagram
    participant User
    participant Web as Next.js Web
    participant Gmail as Gmail API
    participant AI as Claude AI
    participant DB as PostgreSQL

    User->>Web: Connect Gmail (OAuth)
    Web->>Gmail: Fetch unread booking emails
    Gmail-->>Web: Raw email messages
    Web->>AI: Parse email → booking JSON
    AI-->>Web: Structured booking data
    Web->>DB: Find or create trip
    Web->>DB: Insert itinerary_items (isDraft=1)
    Web-->>User: Draft review queue
```

---

## Database Schema (simplified)

```mermaid
erDiagram
    users {
        text id PK
        text email
        text calendar_token
    }
    trips {
        text id PK
        text owner_id FK
        text name
        date start_date
        date end_date
        text status
    }
    itinerary_items {
        text id PK
        text trip_id FK
        text type
        text title
        int day_index
        jsonb details
        int is_draft
    }
    tags {
        text id PK
        text name
        int is_preset
    }
    item_tags {
        text item_id FK
        text tag_id FK
    }
    packing_items {
        text id PK
        text trip_id FK
        text user_id FK
        text category
        text name
        int is_checked
        int is_custom
    }
    documents {
        text id PK
        text trip_id FK
        text storage_key
        text original_name
    }
    participants {
        text trip_id FK
        text email
        text role
    }

    users ||--o{ trips : owns
    trips ||--o{ itinerary_items : contains
    trips ||--o{ packing_items : has
    trips ||--o{ documents : stores
    trips ||--o{ participants : shared_with
    itinerary_items ||--o{ item_tags : tagged_with
    tags ||--o{ item_tags : applied_to
```

---

## Key Design Decisions

### tRPC for API
All client↔server communication (except file uploads and iCal) goes through tRPC. This gives full TypeScript type safety from database query to React component — no manual type definitions, no API contract drift.

### Drizzle ORM
Drizzle generates SQL from TypeScript schema definitions and provides type-safe query builders. Migrations are plain SQL files, making them easy to review and version-control. The `schema` object is passed to the Drizzle client, enabling the relational query API (`db.query.trips.findFirst()`).

### AI-Powered Parsing (Claude)
PDFs and forwarded emails are sent to Claude with a structured prompt that extracts booking data (flight numbers, hotel names, dates, confirmation codes) into a validated JSON schema. The parsed output is always put through a human review step (draft queue) before being committed to the itinerary.

### File Storage (MinIO)
Documents are stored in MinIO (an S3-compatible object store). In production this can be swapped for AWS S3 or Cloudflare R2 with a single endpoint change. All files pass through ClamAV antivirus scanning before being stored.

### Airport Data (Build-Time)
`AIRPORT_COORDS`, `AIRPORT_CITIES`, `AIRPORT_COUNTRIES`, and `COUNTRY_NAMES` are generated at build time from the OurAirports public-domain CSV dataset via `scripts/generate-airports.mjs`. This produces a static TypeScript file (~4,500 airports, 236 countries) that ships with the client bundle — no runtime API calls needed for airport lookups.

### iCal Calendar Feed
Each user has a private, token-authenticated URL (`/api/calendar/[token]`) that returns a standards-compliant iCal (RFC 5545) feed. The feed can be subscribed to in Google Calendar, Apple Calendar, or Outlook. The token can be reset from Settings to invalidate old URLs.

### Packing Lists
Packing lists are generated server-side using a rule-based algorithm that takes into account trip duration, climate (inferred from destination latitude + month), booking types (flights, hotels, car rentals), and activity keywords. Each traveler has their own list per trip. Custom items are preserved across regeneration.

---

## Local Development Services

| Service | Port | Purpose |
|---|---|---|
| Next.js | 3000 | Web application |
| PostgreSQL | 5432 | Primary database |
| Redis | 6379 | Session store |
| MinIO | 9000 | Object storage (S3-compatible) |
| MinIO Console | 9001 | Storage admin UI |
| ClamAV | 3310 | Antivirus scanning |
