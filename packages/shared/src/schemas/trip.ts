import { z } from "zod";
import { TRIP_STATUSES } from "../types/enums";

export const createTripSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  timezone: z.string().optional(),
  status: z.enum(TRIP_STATUSES).optional(),
});

export const updateTripSchema = createTripSchema.partial().extend({
  notes: z.string().optional(),
});

// Output type with defaults applied — used in the API router
export type CreateTripInput = z.infer<typeof createTripSchema>;
export type UpdateTripInput = z.infer<typeof updateTripSchema>;
