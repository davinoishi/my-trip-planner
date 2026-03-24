import { nanoid } from "../utils/id";
import { parseISO } from "date-fns";
import type { ParsedBooking } from "./booking-parser";

type ItemSource = "gmail_poll" | "document_upload";

type Leg = {
  departureDate?: string;
  date?: string;
  departureTime?: string;
  arrivalTime?: string;
  arrivalDate?: string;
  departureAirport?: string;
  arrivalAirport?: string;
  airline?: string;
  carrier?: string;
  flightNumber?: string;
  [key: string]: unknown;
};

function toDayIndex(bookingDate: string, tripStartDate: string): number {
  const diff = Math.round(
    (parseISO(bookingDate).getTime() - parseISO(tripStartDate).getTime()) / 86400000
  );
  return Math.max(0, diff);
}

/**
 * Convert a parsed booking into itinerary item rows ready to insert.
 * Splits multi-leg flights into one item per leg.
 */
export function buildItemsFromParsed(
  parsed: ParsedBooking,
  trip: { id: string; startDate: string },
  source: ItemSource
) {
  const detailsObj = (parsed.details ?? {}) as Record<string, unknown>;

  const rawLegs =
    parsed.type === "flight"
      ? ((detailsObj.legs ?? detailsObj.segments ?? detailsObj.flights) as Leg[] | undefined)
      : undefined;

  const legs = rawLegs?.map((leg) => ({
    ...leg,
    departureDate: leg.departureDate ?? leg.date ?? undefined,
  }));

  const passengerName = detailsObj.passengerName as string | undefined;
  const firstName = passengerName?.split(/\s+/)[0] ?? null;
  const bookingConfirmation = detailsObj.confirmationNumber as string | undefined;
  const ticketNumber = detailsObj.ticketNumber as string | undefined;

  if (legs?.length) {
    return legs.map((leg, i) => {
      const legDate = leg.departureDate ?? parsed.startDate;
      const dayIndex = legDate ? toDayIndex(legDate, trip.startDate) : i;
      const airline = leg.airline ?? leg.carrier ?? "";
      const route =
        leg.departureAirport && leg.arrivalAirport
          ? `${leg.departureAirport}→${leg.arrivalAirport}`
          : "";
      const title = [firstName, airline, leg.flightNumber, route].filter(Boolean).join(" ");

      const legDetails = leg as Record<string, unknown>;
      return {
        id: nanoid(),
        tripId: trip.id,
        type: parsed.type,
        title: title || parsed.title,
        notes: null,
        dayIndex,
        sortOrder: 999,
        source,
        confidenceScore: parsed.confidence,
        startTime: leg.departureTime ?? null,
        endTime: leg.arrivalTime ?? null,
        details: {
          ...legDetails,
          ...(bookingConfirmation && !legDetails.confirmationNumber ? { confirmationNumber: bookingConfirmation } : {}),
          ...(ticketNumber && !legDetails.ticketNumber ? { ticketNumber } : {}),
          ...(passengerName && !legDetails.passengerName ? { passengerName } : {}),
        },
        isDraft: 1,
        version: 1,
      };
    });
  }

  return [
    {
      id: nanoid(),
      tripId: trip.id,
      type: parsed.type,
      title: parsed.title,
      notes: null,
      dayIndex: parsed.startDate ? toDayIndex(parsed.startDate, trip.startDate) : 0,
      sortOrder: 999,
      source,
      confidenceScore: parsed.confidence,
      startTime: parsed.startTime ?? null,
      endTime: parsed.endTime ?? null,
      details: parsed.details ?? {},
      isDraft: 1,
      version: 1,
    },
  ];
}

