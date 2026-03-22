-- Enable useful extensions on first init
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- Full-text search
CREATE EXTENSION IF NOT EXISTS "citext";     -- Case-insensitive text
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- UUID generation (backup for nanoid)

-- Drizzle migrations will create all tables.
-- This file only sets up extensions that must exist before migrations run.
