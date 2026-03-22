import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, emailImports, itineraryItems, trips } from "@trip/db";
import { eq, and, gte, lte } from "drizzle-orm";
import { fetchUnseenEmails } from "@trip/api/lib/imap-client";
import { parseBookingEmail } from "@trip/api/lib/booking-parser";
import { nanoid } from "@trip/api/utils/id";
import { parseISO, isWithinInterval, addDays } from "date-fns";

// ── Trip date matching ─────────────────────────────────────────────────────────

/**
 * Given a booking's startDate, find the best matching trip for a user.
 * Matches if the booking date falls within the trip's start–end range (±1 day buffer).
 */
async function findMatchingTrip(
  userId: string,
  bookingStartDate: string
): Promise<{ id: string; startDate: string; endDate: string } | null> {
  const bookingDate = parseISO(bookingStartDate);

  const userTrips = await db
    .select({ id: trips.id, startDate: trips.startDate, endDate: trips.endDate })
    .from(trips)
    .where(eq(trips.ownerId, userId));

  for (const trip of userTrips) {
    const tripStart = parseISO(trip.startDate);
    const tripEnd = parseISO(trip.endDate);

    // Allow ±1 day buffer for timezone edge cases
    if (
      isWithinInterval(bookingDate, {
        start: addDays(tripStart, -1),
        end: addDays(tripEnd, 1),
      })
    ) {
      return trip;
    }
  }
  return null;
}

/**
 * Convert a booking date + trip start date to a 0-based dayIndex.
 */
function toDayIndex(bookingDate: string, tripStartDate: string): number {
  const booking = parseISO(bookingDate);
  const tripStart = parseISO(tripStartDate);
  const diff = Math.round(
    (booking.getTime() - tripStart.getTime()) / (1000 * 60 * 60 * 24)
  );
  return Math.max(0, diff);
}

// ── Poll handler ───────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user;

  const summary = {
    fetched: 0,
    skipped: 0,   // already processed (dedup)
    parsed: 0,
    matched: 0,
    unmatched: 0,
    failed: 0,
  };

  let emails;
  try {
    emails = await fetchUnseenEmails(20);
  } catch (err: any) {
    return NextResponse.json(
      { error: `IMAP connection failed: ${err?.message ?? err}` },
      { status: 503 }
    );
  }

  summary.fetched = emails.length;

  for (const email of emails) {
    // ── Deduplication ──────────────────────────────────────────────────────
    const existing = await db.query.emailImports.findFirst({
      where: eq(emailImports.messageId, email.messageId),
    });
    if (existing) {
      summary.skipped++;
      continue;
    }

    // ── Parse with Claude ──────────────────────────────────────────────────
    let parsed;
    try {
      parsed = await parseBookingEmail(email.subject, email.bodyText);
    } catch (err) {
      console.error("[Import] Parse error:", err);
      await db.insert(emailImports).values({
        id: nanoid(),
        userId: user.id,
        messageId: email.messageId,
        subject: email.subject,
        fromAddress: email.fromAddress,
        receivedAt: email.receivedAt,
        status: "failed",
        errorMessage: String(err),
        parsedData: null,
        confidenceScore: null,
      });
      summary.failed++;
      continue;
    }

    // Not a travel booking — skip silently (mark as rejected so we don't re-process)
    if (!parsed.isBooking) {
      await db.insert(emailImports).values({
        id: nanoid(),
        userId: user.id,
        messageId: email.messageId,
        subject: email.subject,
        fromAddress: email.fromAddress,
        receivedAt: email.receivedAt,
        status: "rejected",
        parsedData: { isBooking: false },
        confidenceScore: 0,
      });
      summary.skipped++;
      continue;
    }

    summary.parsed++;

    // ── Try to match to a trip ─────────────────────────────────────────────
    const matchedTrip = parsed.startDate
      ? await findMatchingTrip(user.id, parsed.startDate)
      : null;

    if (!matchedTrip) {
      // Store as unmatched — user can assign later
      await db.insert(emailImports).values({
        id: nanoid(),
        userId: user.id,
        messageId: email.messageId,
        subject: email.subject,
        fromAddress: email.fromAddress,
        receivedAt: email.receivedAt,
        status: "unmatched",
        parsedData: parsed,
        confidenceScore: parsed.confidence,
      });
      summary.unmatched++;
      continue;
    }

    // ── Create draft itinerary item ────────────────────────────────────────
    const dayIndex = parsed.startDate
      ? toDayIndex(parsed.startDate, matchedTrip.startDate)
      : 0;

    const [item] = await db
      .insert(itineraryItems)
      .values({
        id: nanoid(),
        tripId: matchedTrip.id,
        type: parsed.type,
        title: parsed.title,
        notes: null,
        dayIndex,
        sortOrder: 999, // append at end — user can reorder on approval
        source: "imap_poll",
        confidenceScore: parsed.confidence,
        startTime: parsed.startTime ?? null,
        endTime: parsed.endTime ?? null,
        details: parsed.details ?? {},
        isDraft: 1,
        version: 1,
      })
      .returning();

    // Record the import with full linkage
    await db.insert(emailImports).values({
      id: nanoid(),
      userId: user.id,
      messageId: email.messageId,
      subject: email.subject,
      fromAddress: email.fromAddress,
      receivedAt: email.receivedAt,
      status: "matched",
      parsedData: parsed,
      confidenceScore: parsed.confidence,
      tripId: matchedTrip.id,
      itemId: item!.id,
    });

    summary.matched++;
  }

  return NextResponse.json({ summary }, { status: 200 });
}
