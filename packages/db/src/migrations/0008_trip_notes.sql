-- Add free-form notes field to trips (separate from the short description shown on cards)
ALTER TABLE "trips" ADD COLUMN "notes" text;
