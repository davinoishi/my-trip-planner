import { db, trips } from "@trip/db";
import { eq } from "drizzle-orm";
import { parseISO, isWithinInterval, addDays, max as dateMax, min as dateMin } from "date-fns";
import { nanoid } from "../utils/id";
import type { ParsedBooking } from "./booking-parser";

export interface TripRef {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

/**
 * Find an existing trip whose date range overlaps the booking dates (±1 day buffer),
 * or create a new trip from the booking. Returns the trip and whether it was created.
 */
export async function findOrCreateTrip(
  userId: string,
  parsed: ParsedBooking
): Promise<{ trip: TripRef; created: boolean }> {
  const startDate = parsed.startDate;
  const endDate = parsed.endDate ?? parsed.startDate;

  if (startDate) {
    const bookingDate = parseISO(startDate);
    const userTrips = await db
      .select({ id: trips.id, name: trips.name, startDate: trips.startDate, endDate: trips.endDate })
      .from(trips)
      .where(eq(trips.ownerId, userId));

    for (const trip of userTrips) {
      if (
        isWithinInterval(bookingDate, {
          start: addDays(parseISO(trip.startDate), -1),
          end: addDays(parseISO(trip.endDate), 1),
        })
      ) {
        return { trip, created: false };
      }
    }
  }

  // No match — create a new trip
  const tripName =
    parsed.suggestedTripName ??
    (startDate ? `Trip – ${startDate}` : "New Trip");

  const [created] = await db
    .insert(trips)
    .values({
      id: nanoid(),
      ownerId: userId,
      name: tripName,
      startDate: startDate ?? new Date().toISOString().slice(0, 10),
      endDate: endDate ?? startDate ?? new Date().toISOString().slice(0, 10),
      timezone: "UTC",
      status: "planning",
    })
    .returning();

  return { trip: created!, created: true };
}

/**
 * For a batch of bookings (e.g. from a single document), find one trip covering
 * the full date range, or create one. All bookings should go into this single trip.
 */
export async function findOrCreateTripForRange(
  userId: string,
  bookings: ParsedBooking[]
): Promise<{ trip: TripRef; created: boolean }> {
  const dates = bookings.flatMap((b) => [b.startDate, b.endDate]).filter(Boolean) as string[];
  if (dates.length === 0) {
    return findOrCreateTrip(userId, bookings[0]!);
  }

  const parsedDates = dates.map((d) => parseISO(d));
  const minDate = dateMin(parsedDates as [Date, ...Date[]]).toISOString().slice(0, 10);
  const maxDate = dateMax(parsedDates as [Date, ...Date[]]).toISOString().slice(0, 10);

  // Find a trip that overlaps with ANY part of this range
  const userTrips = await db
    .select({ id: trips.id, name: trips.name, startDate: trips.startDate, endDate: trips.endDate })
    .from(trips)
    .where(eq(trips.ownerId, userId));

  const rangeStart = addDays(parseISO(minDate), -1);
  const rangeEnd = addDays(parseISO(maxDate), 1);

  for (const trip of userTrips) {
    const tripStart = parseISO(trip.startDate);
    const tripEnd = parseISO(trip.endDate);
    // Overlaps if trip doesn't end before range starts and doesn't start after range ends
    if (tripEnd >= rangeStart && tripStart <= rangeEnd) {
      // Expand trip dates if needed to cover the full range
      const newStart = dateMin([tripStart, parseISO(minDate)] as [Date, ...Date[]]).toISOString().slice(0, 10);
      const newEnd = dateMax([tripEnd, parseISO(maxDate)] as [Date, ...Date[]]).toISOString().slice(0, 10);
      if (newStart !== trip.startDate || newEnd !== trip.endDate) {
        const [updated] = await db
          .update(trips)
          .set({ startDate: newStart, endDate: newEnd })
          .where(eq(trips.id, trip.id))
          .returning();
        return { trip: { ...trip, startDate: newStart, endDate: newEnd }, created: false };
      }
      return { trip, created: false };
    }
  }

  // No match — create a new trip
  const tripName =
    bookings.find((b) => b.suggestedTripName)?.suggestedTripName ??
    `Trip – ${minDate}`;

  const [created] = await db
    .insert(trips)
    .values({
      id: nanoid(),
      ownerId: userId,
      name: tripName,
      startDate: minDate,
      endDate: maxDate,
      timezone: "UTC",
      status: "planning",
    })
    .returning();

  return { trip: created!, created: true };
}

