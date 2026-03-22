ALTER TABLE "itinerary_items" ADD COLUMN "start_time" text;--> statement-breakpoint
ALTER TABLE "itinerary_items" ADD COLUMN "end_time" text;--> statement-breakpoint
ALTER TABLE "itinerary_items" ADD COLUMN "details" jsonb;