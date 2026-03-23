CREATE TABLE "audit_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "action" text NOT NULL,
  "resource_type" text NOT NULL,
  "resource_id" text,
  "metadata" jsonb,
  "ip_address" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "audit_logs_user_idx" ON "audit_logs" ("user_id");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" ("action");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" ("created_at");
