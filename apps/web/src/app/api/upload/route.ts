import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, documents, trips, participants } from "@trip/db";
import { eq, and } from "drizzle-orm";
import { uploadFile } from "@trip/api/lib/storage";
import { scanBuffer } from "@trip/api/lib/clamav";
import { nanoid } from "@trip/api/utils/id";

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
  const trip = await db.query.trips.findFirst({
    where: eq(trips.id, tripId),
  });
  if (!trip) return false;
  if (trip.ownerId === userId) return true;

  const participant = await db.query.participants.findFirst({
    where: and(
      eq(participants.tripId, tripId),
      eq(participants.email, userEmail)
    ),
  });
  return !!participant && participant.role !== "viewer";
}

export async function POST(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user;

  // ── Parse multipart form ─────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const tripId = formData.get("tripId") as string | null;
  const itemId = formData.get("itemId") as string | null;
  const category = (formData.get("category") as string | null) ?? "other";

  if (!file || !tripId) {
    return NextResponse.json(
      { error: "file and tripId are required" },
      { status: 400 }
    );
  }

  // ── Validate category ─────────────────────────────────────────────────────
  if (!VALID_CATEGORIES.includes(category as DocumentCategory)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  // ── Validate file type ────────────────────────────────────────────────────
  const ext = ALLOWED_MIME_TYPES[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "File type not allowed. Accepted: PDF, JPEG, PNG, WebP, HEIC" },
      { status: 400 }
    );
  }

  // ── Validate file size ────────────────────────────────────────────────────
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File exceeds 10 MB limit" },
      { status: 400 }
    );
  }

  // ── Check trip access ─────────────────────────────────────────────────────
  const hasAccess = await assertTripAccess(user.id, user.email, tripId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Read file into buffer ─────────────────────────────────────────────────
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // ── ClamAV scan (optional — skipped if service unavailable) ───────────────
  const scanResult = await scanBuffer(buffer);
  if (!scanResult.clean) {
    return NextResponse.json(
      { error: `File failed virus scan: ${scanResult.threat}` },
      { status: 422 }
    );
  }

  // ── Upload to MinIO ───────────────────────────────────────────────────────
  const storageKey = `trips/${tripId}/${nanoid()}.${ext}`;
  try {
    await uploadFile(storageKey, buffer, file.type);
  } catch (err) {
    console.error("[Upload] MinIO error:", err);
    return NextResponse.json(
      { error: "Storage upload failed" },
      { status: 500 }
    );
  }

  // ── Insert DB record ──────────────────────────────────────────────────────
  const [doc] = await db
    .insert(documents)
    .values({
      id: nanoid(),
      tripId,
      itemId: itemId || null,
      uploadedBy: user.id,
      originalName: file.name,
      storageKey,
      mimeType: file.type,
      fileSize: file.size,
      category: category as DocumentCategory,
      scanPassed: scanResult.skipped ? 1 : 1, // 1 = clean/skipped
    })
    .returning();

  return NextResponse.json({ document: doc }, { status: 201 });
}
