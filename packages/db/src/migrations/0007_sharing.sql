-- Add isGoingOnTrip to participants
ALTER TABLE "participants" ADD COLUMN "is_going_on_trip" integer NOT NULL DEFAULT 0;

-- Add email index for pending invite lookups
CREATE INDEX IF NOT EXISTS "participants_email_idx" ON "participants" ("email");

-- Account-level sharing table
CREATE TABLE "account_shares" (
  "id" text PRIMARY KEY NOT NULL,
  "owner_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "shared_with_email" text NOT NULL,
  "shared_with_user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "role" "participant_role" NOT NULL DEFAULT 'viewer',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "account_shares_owner_email_unique" UNIQUE ("owner_id", "shared_with_email")
);

CREATE INDEX "account_shares_owner_idx" ON "account_shares" ("owner_id");
CREATE INDEX "account_shares_user_idx" ON "account_shares" ("shared_with_user_id");
CREATE INDEX "account_shares_email_idx" ON "account_shares" ("shared_with_email");
