import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, emailImports, itineraryItems } from "@trip/db";
import { eq } from "drizzle-orm";
import { fetchUnseenEmails } from "@trip/api/lib/gmail-client";
import { parseBookingEmail } from "@trip/api/lib/booking-parser";
import { findOrCreateTrip } from "@trip/api/lib/trip-matcher";
import { buildItemsFromParsed } from "@trip/api/lib/booking-to-items";
import { nanoid } from "@trip/api/utils/id";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user;

  const summary = {
    fetched: 0,
    skipped: 0,
    parsed: 0,
    matched: 0,
    created: 0,
    failed: 0,
  };

  // tripId → { id, name, created } — track all trips touched this run
  const tripsMap = new Map<string, { id: string; name: string; created: boolean }>();

  let emails;
  try {
    emails = await fetchUnseenEmails(user.id, 20);
  } catch (err: any) {
    return NextResponse.json(
      { error: `Gmail fetch failed: ${err?.message ?? err}` },
      { status: 503 }
    );
  }

  summary.fetched = emails.length;

  for (const email of emails) {
    // ── Deduplication ────────────────────────────────────────────────────────
    const existing = await db.query.emailImports.findFirst({
      where: eq(emailImports.messageId, email.messageId),
    });
    if (existing && !["failed", "rejected"].includes(existing.status)) {
      summary.skipped++;
      continue;
    }
    if (existing) {
      await db.delete(emailImports).where(eq(emailImports.messageId, email.messageId));
    }

    // ── Parse with Claude ────────────────────────────────────────────────────
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

    // ── Find or create trip ──────────────────────────────────────────────────
    const { trip, created } = await findOrCreateTrip(user.id, parsed);

    if (created) {
      summary.created++;
    } else {
      summary.matched++;
    }

    if (!tripsMap.has(trip.id)) {
      tripsMap.set(trip.id, { id: trip.id, name: trip.name, created });
    }

    // ── Create draft itinerary items ─────────────────────────────────────────
    const itemsToCreate = buildItemsFromParsed(parsed, trip, "gmail_poll");
    const insertedItems = await db.insert(itineraryItems).values(itemsToCreate).returning();

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
      tripId: trip.id,
      itemId: insertedItems[0]!.id,
    });
  }

  const trips = Array.from(tripsMap.values());

  return NextResponse.json({ summary, trips }, { status: 200 });
}
