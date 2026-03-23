import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, documents, trips, participants, itineraryItems } from "@trip/db";
import { eq, and } from "drizzle-orm";
import { uploadFile } from "@trip/api/lib/storage";
import { scanBuffer } from "@trip/api/lib/clamav";
import { parseBookingDocument } from "@trip/api/lib/booking-parser";
import { findOrCreateTripForRange } from "@trip/api/lib/trip-matcher";
import { buildItemsFromParsed } from "@trip/api/lib/booking-to-items";
import { nanoid } from "@trip/api/utils/id";
import { rateLimit } from "@trip/api/lib/rate-limit";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

const VALID_CATEGORIES = [
  "boarding_pass",
  "insurance",
  "ticket",
  "visa",
  "passport",
  "hotel_booking",
  "car_rental",
  "train_ticket",
  "other",
] as const;

type DocumentCategory = (typeof VALID_CATEGORIES)[number];

async function assertTripAccess(
  userId: string,
  userEmail: string,
  tripId: string
): Promise<boolean> {
  const trip = await db.query.trips.findFirst({ where: eq(trips.id, tripId) });
  if (!trip) return false;
  if (trip.ownerId === userId) return true;
  const participant = await db.query.participants.findFirst({
    where: and(eq(participants.tripId, tripId), eq(participants.email, userEmail)),
  });
  return !!participant && participant.role !== "viewer";
}

export async function POST(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user;

  // ── Rate limit: 10 uploads per user per hour (each triggers Claude AI) ───────
  const rl = await rateLimit(`upload:${user.id}`, 10, 3600);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many uploads. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rl.resetInSeconds) } }
    );
  }

  // ── Parse multipart form ────────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const tripId = (formData.get("tripId") as string | null) || null; // optional
  const itemId = (formData.get("itemId") as string | null) || null;
  const category = (formData.get("category") as string | null) ?? "other";

  if (!file) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  // ── Validate category ───────────────────────────────────────────────────────
  if (!VALID_CATEGORIES.includes(category as DocumentCategory)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  // ── Validate file type ──────────────────────────────────────────────────────
  const ext = ALLOWED_MIME_TYPES[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "File type not allowed. Accepted: PDF, JPEG, PNG, WebP, HEIC" },
      { status: 400 }
    );
  }

  // ── Validate file size ──────────────────────────────────────────────────────
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File exceeds 10 MB limit" }, { status: 400 });
  }

  // ── Check trip access (only when tripId provided) ───────────────────────────
  if (tripId) {
    const hasAccess = await assertTripAccess(user.id, user.email, tripId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // ── Read file into buffer ───────────────────────────────────────────────────
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // ── ClamAV scan (optional — skipped if service unavailable) ────────────────
  const scanResult = await scanBuffer(buffer);
  if (!scanResult.clean) {
    return NextResponse.json(
      { error: `File failed virus scan: ${scanResult.threat}` },
      { status: 422 }
    );
  }

  // ── Parse document with Claude ──────────────────────────────────────────────
  let resolvedTripId = tripId;
  let tripCreated = false;
  let tripName: string | null = null;
  let draftItems: { id: string; title: string }[] = [];
  let parseReason: string | null = null;

  try {
    const parsedList = await parseBookingDocument(buffer, file.type, file.name);

    if (parsedList === null) {
      parseReason = "File type cannot be read by the parser.";
    } else {
      const bookings = parsedList.filter((p) => p.isBooking);
      if (bookings.length === 0) {
        parseReason = parsedList[0]?.reasoning || "Document does not appear to contain travel booking information.";
      } else {
        // All bookings from one document belong to one trip — find/create using full date range
        const { trip, created } = await findOrCreateTripForRange(user.id, bookings);
        resolvedTripId = trip.id;
        tripCreated = created;
        tripName = trip.name;

        for (const parsed of bookings) {
          const itemsToCreate = buildItemsFromParsed(parsed, trip, "document_upload");
          const inserted = await db.insert(itineraryItems).values(itemsToCreate).returning();
          draftItems.push(...inserted.map((it) => ({ id: it.id, title: it.title })));
        }
      }
    }
  } catch (err) {
    console.error("[Upload] Document parse error:", err);
    parseReason = `Parse error: ${err instanceof Error ? err.message : String(err)}`;
  }

  // If no tripId was provided and parsing didn't resolve one, we can't store the document
  if (!resolvedTripId) {
    const reason = parseReason ? ` Reason: ${parseReason}` : "";
    return NextResponse.json(
      { error: `Could not extract booking information from this document.${reason}` },
      { status: 422 }
    );
  }

  // ── Upload to MinIO ─────────────────────────────────────────────────────────
  const storageTripId = resolvedTripId;
  const storageKey = `trips/${storageTripId}/${nanoid()}.${ext}`;
  try {
    await uploadFile(storageKey, buffer, file.type);
  } catch (err) {
    console.error("[Upload] MinIO error:", err);
    return NextResponse.json({ error: "Storage upload failed" }, { status: 500 });
  }

  // ── Insert DB record ────────────────────────────────────────────────────────
  const [doc] = await db
    .insert(documents)
    .values({
      id: nanoid(),
      tripId: resolvedTripId,
      itemId,
      uploadedBy: user.id,
      originalName: file.name,
      storageKey,
      mimeType: file.type,
      fileSize: file.size,
      category: category as DocumentCategory,
      scanPassed: 1,
    })
    .returning();

  return NextResponse.json(
    { document: doc!, draftItems, tripId: resolvedTripId, tripCreated, tripName },
    { status: 201 }
  );
}
