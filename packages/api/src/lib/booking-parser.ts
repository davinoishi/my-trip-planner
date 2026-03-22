import Anthropic from "@anthropic-ai/sdk";
import type { BookingType } from "@trip/shared";

export interface ParsedBooking {
  isBooking: boolean;       // false if email is not a travel booking
  type: BookingType;
  title: string;
  startDate: string | null; // YYYY-MM-DD
  endDate: string | null;   // YYYY-MM-DD (for multi-day bookings like hotels)
  startTime: string | null; // HH:MM
  endTime: string | null;   // HH:MM
  details: Record<string, unknown>;
  confidence: number;       // 0.0–1.0
  reasoning: string;        // brief explanation for low-confidence items
}

const SYSTEM_PROMPT = `You are a travel booking email parser. Your job is to extract structured booking information from confirmation emails.

When given an email body, you MUST respond with a single valid JSON object and nothing else — no markdown, no explanation, just JSON.

JSON schema:
{
  "isBooking": boolean,          // true only if this is clearly a travel booking confirmation
  "type": string,                // one of: flight, hotel, car_rental, train, activity, transfer, note
  "title": string,               // concise title, e.g. "Air Canada AC123 YVR→NRT" or "Hilton Tokyo"
  "startDate": string | null,    // YYYY-MM-DD — departure/check-in date
  "endDate": string | null,      // YYYY-MM-DD — return/check-out date (null if same day or unknown)
  "startTime": string | null,    // HH:MM 24h format
  "endTime": string | null,      // HH:MM 24h format
  "confidence": number,          // 0.0–1.0 confidence in the extraction accuracy
  "reasoning": string,           // one sentence: why confidence is low, or "High confidence extraction"
  "details": {                   // type-specific fields — include only what is present in the email
    // FLIGHT: airline, flightNumber, departureAirport (IATA), arrivalAirport (IATA),
    //         departureTime (HH:MM), arrivalTime (HH:MM), confirmationNumber, cabinClass, seat, terminal
    // HOTEL:  hotelName, address, checkInTime, checkOutTime, confirmationNumber, roomType, bookingUrl, phone
    // CAR:    company, carType, pickupLocation, dropoffLocation, pickupTime, dropoffTime, confirmationNumber
    // TRAIN:  carrier, trainNumber, departureStation, arrivalStation, departureTime, arrivalTime, confirmationNumber, seatNumber
    // ACTIVITY: venue, address, startTime, endTime, confirmationNumber, bookingUrl, phone
    // TRANSFER: provider, pickupLocation, dropoffLocation, pickupTime, confirmationNumber, phone
  }
}

Rules:
- If the email is NOT a travel booking (newsletters, receipts for non-travel, etc.), set isBooking: false and use placeholder values for other fields.
- For flights, always try to extract IATA airport codes (3 letters).
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

/**
 * Parse a booking confirmation email using Claude.
 * Uses claude-haiku for low cost on high-volume parsing.
 */
export async function parseBookingEmail(
  subject: string,
  bodyText: string
): Promise<ParsedBooking> {
  const client = getClient();

  const userMessage = `Subject: ${subject}\n\n${bodyText}`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
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
