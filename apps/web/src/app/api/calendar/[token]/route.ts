import { NextRequest, NextResponse } from "next/server";
import { db, users, trips, itineraryItems } from "@trip/db";
import { eq, inArray, and } from "drizzle-orm";

// ── ICS helpers ────────────────────────────────────────────────────────────────

function escapeIcsText(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** RFC 5545 §3.1: fold lines longer than 75 octets (CRLF + leading space). */
function foldLine(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line + "\r\n";

  let result = "";
  let pos = 0;
  let first = true;
  while (pos < bytes.length) {
    const limit = first ? 75 : 74;
    let end = Math.min(pos + limit, bytes.length);
    // Don't split a multi-byte UTF-8 sequence
    while (end < bytes.length && (bytes[end]! & 0xc0) === 0x80) end--;
    result += (first ? "" : " ") + bytes.slice(pos, end).toString("utf8") + "\r\n";
    pos = end;
    first = false;
  }
  return result;
}

/** Returns "YYYYMMDD" for startDate + dayIndex days. */
function getItemDateStr(tripStartDate: string, dayIndex: number): string {
  const d = new Date(tripStartDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + dayIndex);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

/** Returns "YYYYMMDD" for a date string + n days (for exclusive DTEND). */
function offsetDateStr(dateStr: string, days: number): string {
  const clean = dateStr.replace(/-/g, "");
  const d = new Date(
    `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}T00:00:00Z`
  );
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

/** Build DTSTART / DTEND lines for a timed event. */
function dtLines(
  prop: "DTSTART" | "DTEND",
  dateStr: string,
  timeStr: string,
  tz: string
): string {
  const dt = `${dateStr}T${timeStr.replace(":", "")}00`;
  if (tz === "UTC") return `${prop}:${dt}Z`;
  return `${prop};TZID=${tz}:${dt}`;
}

/** Add 1 hour to "HH:MM", clamping at "23:59". */
function addOneHour(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const newH = (h! + 1) % 24;
  return `${String(newH).padStart(2, "0")}:${String(m!).padStart(2, "0")}`;
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const user = await db.query.users.findFirst({
    where: eq(users.calendarToken, token),
  });
  if (!user) {
    return new NextResponse("Not found", { status: 404 });
  }

  const userTrips = await db
    .select()
    .from(trips)
    .where(eq(trips.ownerId, user.id));

  const tripIds = userTrips.map((t) => t.id);
  const items =
    tripIds.length > 0
      ? await db
          .select()
          .from(itineraryItems)
          .where(
            and(
              inArray(itineraryItems.tripId, tripIds),
              eq(itineraryItems.isDraft, 0)
            )
          )
      : [];

  // Group items by tripId
  const itemsByTrip = new Map<string, typeof items>();
  for (const item of items) {
    if (!itemsByTrip.has(item.tripId)) itemsByTrip.set(item.tripId, []);
    itemsByTrip.get(item.tripId)!.push(item);
  }

  const now =
    new Date()
      .toISOString()
      .replace(/[-:.]/g, "")
      .slice(0, 15) + "Z";

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MyTripPlanner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(user.name + "'s Trips")}`,
    "X-WR-TIMEZONE:UTC",
  ];

  for (const trip of userTrips) {
    // ── Trip all-day block ──────────────────────────────────────────────────
    const tripStart = trip.startDate.replace(/-/g, "");
    const tripEnd = offsetDateStr(trip.endDate.replace(/-/g, ""), 1); // exclusive DTEND

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:trip-${trip.id}@mytripplanner`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(`DTSTART;VALUE=DATE:${tripStart}`);
    lines.push(`DTEND;VALUE=DATE:${tripEnd}`);
    lines.push(`SUMMARY:${escapeIcsText("✈ " + trip.name)}`);
    if (trip.description) {
      lines.push(`DESCRIPTION:${escapeIcsText(trip.description)}`);
    }
    lines.push("END:VEVENT");

    const tz = trip.timezone || "UTC";

    // ── Item events ─────────────────────────────────────────────────────────
    for (const item of itemsByTrip.get(trip.id) ?? []) {
      const dateStr = getItemDateStr(trip.startDate, item.dayIndex);

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:item-${item.id}@mytripplanner`);
      lines.push(`DTSTAMP:${now}`);

      if (item.startTime) {
        const endTime = item.endTime ?? addOneHour(item.startTime);
        lines.push(dtLines("DTSTART", dateStr, item.startTime, tz));
        lines.push(dtLines("DTEND", dateStr, endTime, tz));
      } else {
        lines.push(`DTSTART;VALUE=DATE:${dateStr}`);
        lines.push(`DTEND;VALUE=DATE:${offsetDateStr(dateStr, 1)}`);
      }

      lines.push(`SUMMARY:${escapeIcsText(item.title)}`);

      // Build a description from notes + key booking details
      const descParts: string[] = [];
      if (item.notes) descParts.push(item.notes);
      const d = (item.details ?? {}) as Record<string, unknown>;
      if (d.confirmationNumber) descParts.push(`Confirmation: ${d.confirmationNumber}`);
      if (d.flightNumber) descParts.push(`Flight: ${d.flightNumber}`);
      if (d.airline) descParts.push(`Airline: ${d.airline}`);
      if (d.hotelName) descParts.push(`Hotel: ${d.hotelName}`);
      if (descParts.length > 0) {
        lines.push(`DESCRIPTION:${escapeIcsText(descParts.join("\n"))}`);
      }

      // LOCATION from common address fields
      const location =
        (d.address as string | undefined) ||
        (d.pickupLocation as string | undefined) ||
        (d.venue as string | undefined);
      if (location) lines.push(`LOCATION:${escapeIcsText(location)}`);

      lines.push("END:VEVENT");
    }
  }

  lines.push("END:VCALENDAR");

  const icsBody = lines.map(foldLine).join("");

  return new NextResponse(icsBody, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="my-trips.ics"',
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
