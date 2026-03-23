import Anthropic from "@anthropic-ai/sdk";
import type { BookingType } from "@trip/shared";

export interface ParsedBooking {
  isBooking: boolean;           // false if email is not a travel booking
  type: BookingType;
  title: string;
  suggestedTripName: string | null; // short destination name for auto-creating a trip, e.g. "Japan", "Paris"
  startDate: string | null;     // YYYY-MM-DD
  endDate: string | null;       // YYYY-MM-DD (for multi-day bookings like hotels)
  startTime: string | null;     // HH:MM
  endTime: string | null;       // HH:MM
  details: Record<string, unknown>;
  confidence: number;           // 0.0–1.0
  reasoning: string;            // brief explanation for low-confidence items
}

const SYSTEM_PROMPT = `You are a travel booking email parser. Your job is to extract structured booking information from confirmation emails.

When given an email body, you MUST respond with a single valid JSON object and nothing else — no markdown, no explanation, just JSON.

JSON schema:
{
  "isBooking": boolean,          // true only if this is clearly a travel booking confirmation
  "type": string,                // one of: flight, hotel, car_rental, train, activity, transfer, note
  "title": string,               // concise title, e.g. "Air Canada AC123 YVR→NRT" or "Hilton Tokyo"
  "suggestedTripName": string | null, // short destination name for the trip, e.g. "Japan", "Hong Kong", "Paris" — null if unclear
  "startDate": string | null,    // YYYY-MM-DD — departure/check-in date
  "endDate": string | null,      // YYYY-MM-DD — return/check-out date (null if same day or unknown)
  "startTime": string | null,    // HH:MM 24h format
  "endTime": string | null,      // HH:MM 24h format
  "confidence": number,          // 0.0–1.0 confidence in the extraction accuracy
  "reasoning": string,           // one sentence: why confidence is low, or "High confidence extraction"
  "details": {                   // type-specific fields — include only what is present in the email

    // SINGLE-LEG FLIGHT:
    //   airline, flightNumber, departureAirport (IATA), arrivalAirport (IATA),
    //   departureTime (HH:MM), arrivalTime (HH:MM), confirmationNumber, cabinClass, seat, terminal

    // MULTI-LEG FLIGHT — use this structure whenever there is more than one flight segment:
    //   airline (string), confirmationNumber, cabinClass, passengerName,
    //   legs: [                    // MUST be called "legs" — never "segments", "flights", or any other name
    //     {
    //       flightNumber,          // e.g. "JL 17"
    //       airline,               // operating carrier for this leg
    //       departureAirport,      // IATA code
    //       arrivalAirport,        // IATA code
    //       departureDate,         // YYYY-MM-DD — MUST be called "departureDate"
    //       arrivalDate,           // YYYY-MM-DD
    //       departureTime,         // HH:MM 24h
    //       arrivalTime,           // HH:MM 24h
    //       aircraft, cabinClass, seat
    //     }
    //   ]

    // HOTEL:  hotelName, address, checkInTime, checkOutTime, confirmationNumber, roomType, bookingUrl, phone
    // CAR:    company, carType, pickupLocation, dropoffLocation, pickupTime, dropoffTime, confirmationNumber
    // TRAIN:  carrier, trainNumber, departureStation, arrivalStation, departureTime, arrivalTime, confirmationNumber, seatNumber
    // ACTIVITY: venue, address, startTime, endTime, confirmationNumber, bookingUrl, phone
    // TRANSFER: provider, pickupLocation, dropoffLocation, pickupTime, confirmationNumber, phone
  }
}

Rules:
- If the email is NOT a travel booking (newsletters, receipts for non-travel, etc.), set isBooking: false and use placeholder values for other fields.
- For flights, always extract IATA airport codes (3 letters). Never leave departureAirport or arrivalAirport as null if the information is in the email.
- For multi-leg flights, ALWAYS use the "legs" array key — never "segments", "flights", or anything else.
- Each leg in the legs array MUST have "departureDate" (YYYY-MM-DD) — never use "date" alone.
- Times should be in 24h HH:MM format. Convert 12h if needed.
- Confirmation numbers are critical — extract them carefully.
- confidence < 0.7 means you are unsure about one or more key fields.`;

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

// MIME types Claude can read natively as images
const CLAUDE_IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]);

/**
 * Parse a booking confirmation email using Claude.
 */
export async function parseBookingEmail(
  subject: string,
  bodyText: string
): Promise<ParsedBooking> {
  const client = getClient();

  const userMessage = `Subject: ${subject}\n\n${bodyText}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const rawText =
    message.content[0]?.type === "text" ? message.content[0].text : "";

  // Strip any accidental markdown code fences
  const jsonText = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: ParsedBooking;
  try {
    parsed = JSON.parse(jsonText) as ParsedBooking;
  } catch {
    // If Claude returns unparseable JSON, treat as non-booking
    return {
      isBooking: false,
      type: "note",
      title: subject,
      suggestedTripName: null,
      startDate: null,
      endDate: null,
      startTime: null,
      endTime: null,
      details: {},
      confidence: 0,
      reasoning: `JSON parse error: ${jsonText.slice(0, 100)}`,
    };
  }

  return parsed;
}

const DOCUMENT_SYSTEM_PROMPT = `You are a travel document parser. Your job is to extract structured booking information from travel documents such as PDFs, itineraries, boarding passes, hotel confirmations, car rental receipts, and ticket images.

A document may contain ONE booking or MULTIPLE bookings (e.g. a full trip itinerary with flights, hotel, and activities).

You MUST respond with a single valid JSON array and nothing else — no markdown, no explanation, just a JSON array.

Each element in the array uses this schema:
{
  "isBooking": boolean,
  "type": string,                // one of: flight, hotel, car_rental, train, activity, transfer, note
  "title": string,               // concise title, e.g. "JL 17 YVR→NRT" or "Hilton Tokyo"
  "suggestedTripName": string | null,
  "startDate": string | null,    // YYYY-MM-DD
  "endDate": string | null,      // YYYY-MM-DD
  "startTime": string | null,    // HH:MM 24h
  "endTime": string | null,      // HH:MM 24h
  "confidence": number,
  "reasoning": string,
  "details": {
    // SINGLE-LEG FLIGHT: airline, flightNumber, departureAirport (IATA), arrivalAirport (IATA),
    //   departureTime, arrivalTime, confirmationNumber, cabinClass, seat, passengerName

    // MULTI-LEG FLIGHT — use legs array (key must be "legs"):
    //   airline, confirmationNumber, cabinClass, passengerName,
    //   legs: [{ flightNumber, airline, departureAirport, arrivalAirport,
    //            departureDate (YYYY-MM-DD), arrivalDate, departureTime, arrivalTime,
    //            aircraft, cabinClass, seat }]

    // HOTEL: hotelName, address, checkInTime, checkOutTime, confirmationNumber, roomType
    // CAR: company, carType, pickupLocation, dropoffLocation, pickupTime, dropoffTime, confirmationNumber
    // TRAIN: carrier, trainNumber, departureStation, arrivalStation, departureTime, arrivalTime, confirmationNumber
    // ACTIVITY: venue, address, startTime, endTime, confirmationNumber
    // TRANSFER: provider, pickupLocation, dropoffLocation, pickupTime, confirmationNumber
  }
}

Rules:
- Always return a JSON array, even if there is only one booking (return a single-element array).
- If the document contains no travel bookings, return an empty array: []
- For flights, extract IATA airport codes (3 letters). Use the "legs" array for any multi-segment flight.
- Each leg in legs MUST have "departureDate" (YYYY-MM-DD).
- Times in HH:MM 24h format.
- suggestedTripName: short destination name like "Japan" or "Paris", null if unclear.
- Extract ALL bookings present in the document — do not skip any.`;

/**
 * Parse a travel document (PDF or image) using Claude's native document/vision support.
 * Returns an array of parsed bookings (may be empty), or null if the file type is unsupported.
 */
export async function parseBookingDocument(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<ParsedBooking[] | null> {
  const isPdf = mimeType === "application/pdf";
  const isImage = CLAUDE_IMAGE_TYPES.has(mimeType);

  if (!isPdf && !isImage) return null;

  const client = getClient();
  const base64 = buffer.toString("base64");

  const contentBlock = isPdf
    ? ({
        type: "document" as const,
        source: { type: "base64" as const, media_type: "application/pdf" as const, data: base64 },
      })
    : ({
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: mimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
          data: base64,
        },
      });

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: DOCUMENT_SYSTEM_PROMPT,
    messages: [{
      role: "user",
      content: [
        contentBlock,
        { type: "text", text: `Filename: ${filename}\n\nExtract all travel bookings from this document as a JSON array.` },
      ],
    }],
  });

  const rawText = message.content[0]?.type === "text" ? message.content[0].text : "";

  // Extract JSON robustly — find the outermost [ ] or { } rather than relying on code fences
  const arrayStart = rawText.indexOf("[");
  const arrayEnd = rawText.lastIndexOf("]");
  const objectStart = rawText.indexOf("{");

  let jsonText: string;
  if (arrayStart !== -1 && (arrayStart < objectStart || objectStart === -1) && arrayEnd > arrayStart) {
    jsonText = rawText.slice(arrayStart, arrayEnd + 1);
  } else {
    // Fallback: strip code fences
    jsonText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  }

  try {
    const parsed = JSON.parse(jsonText);
    return Array.isArray(parsed) ? parsed as ParsedBooking[] : [parsed as ParsedBooking];
  } catch (e) {
    console.error("[DocumentParser] Raw response:", rawText.slice(0, 500));
    throw new Error(`JSON parse error: ${(e as Error).message}`);
  }
}
