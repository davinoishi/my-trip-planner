CREATE TYPE "public"."email_import_status" AS ENUM('matched', 'unmatched', 'rejected', 'failed');--> statement-breakpoint
CREATE TABLE "email_imports" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"message_id" text NOT NULL,
	"subject" text NOT NULL,
	"from_address" text NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"status" "email_import_status" NOT NULL,
	"parsed_data" jsonb,
	"confidence_score" real,
	"trip_id" text,
	"item_id" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_imports_message_id_unique" UNIQUE("message_id")
);
--> statement-breakpoint
ALTER TABLE "email_imports" ADD CONSTRAINT "email_imports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_imports" ADD CONSTRAINT "email_imports_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_imports" ADD CONSTRAINT "email_imports_item_id_itinerary_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."itinerary_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_imports_user_id_idx" ON "email_imports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "email_imports_status_idx" ON "email_imports" USING btree ("status");
