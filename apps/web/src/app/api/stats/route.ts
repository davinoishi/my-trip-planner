import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, trips, itineraryItems, participants } from "@trip/db";
import { eq, or, and } from "drizzle-orm";
import { AIRPORT_COORDS, AIRPORT_COUNTRIES, AIRPORT_CITIES, COUNTRY_NAMES } from "@/lib/airports";

// ── Haversine distance (km) ────────────────────────────────────────────────────

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Stats computation ─────────────────────────────────────────────────────────

function computeStats(allTrips: typeof trips.$inferSelect[], allItems: (typeof itineraryItems.$inferSelect)[], year: number | null) {
  const filteredTrips = year
    ? allTrips.filter((t) => new Date(t.startDate + "T00:00:00Z").getUTCFullYear() === year)
    : allTrips;

  const tripIds = new Set(filteredTrips.map((t) => t.id));
  const filteredItems = allItems.filter((i) => tripIds.has(i.tripId));

  let totalDistanceKm = 0;
  const countryCodes = new Set<string>();
  const cities = new Set<string>();

  // Total days: sum of each trip's duration
  let totalDays = 0;
  for (const trip of filteredTrips) {
    const start = new Date(trip.startDate + "T00:00:00Z");
    const end = new Date(trip.endDate + "T00:00:00Z");
    const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    totalDays += Math.max(days, 1);
  }

  // Process flight items for distance, countries, cities
  for (const item of filteredItems) {
    if (item.type !== "flight") continue;
    const d = (item.details ?? {}) as Record<string, unknown>;
    type Leg = { departureAirport?: string; arrivalAirport?: string };
    const legs = (d.legs ?? d.segments ?? d.flights) as Leg[] | undefined;

    if (legs?.length) {
      for (const leg of legs) {
        const origin = leg.departureAirport;
        const dest = leg.arrivalAirport;
        if (origin && dest) {
          const from = AIRPORT_COORDS[origin];
          const to = AIRPORT_COORDS[dest];
          if (from && to) {
            totalDistanceKm += haversine(from[1], from[0], to[1], to[0]);
          }
          // Destination country + city
          const countryCode = AIRPORT_COUNTRIES[dest];
          if (countryCode) countryCodes.add(countryCode);
          const city = AIRPORT_CITIES[dest];
          if (city) cities.add(city);
        }
      }
    } else {
      // Flat structure
      const origin = d.departureAirport as string | undefined;
      const dest = d.arrivalAirport as string | undefined;
      if (origin && dest) {
        const from = AIRPORT_COORDS[origin];
        const to = AIRPORT_COORDS[dest];
        if (from && to) {
          totalDistanceKm += haversine(from[1], from[0], to[1], to[0]);
        }
        const countryCode = AIRPORT_COUNTRIES[dest];
        if (countryCode) countryCodes.add(countryCode);
        const city = AIRPORT_CITIES[dest];
        if (city) cities.add(city);
      }
    }
  }

  // Hotel cities
  for (const item of filteredItems) {
    if (item.type !== "hotel") continue;
    const d = (item.details ?? {}) as Record<string, unknown>;
    const address = d.address as string | undefined;
    if (address) {
      // Extract last 1-2 comma-separated parts as city
      const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        // Second-to-last is often the city
        cities.add(parts[parts.length - 2]!);
      } else if (parts.length === 1) {
        cities.add(parts[0]!);
      }
    }
  }

  const countriesList = [...countryCodes]
    .map((code) => ({ code, name: COUNTRY_NAMES[code] ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const citiesList = [...cities].sort();

  return {
    totalTrips: filteredTrips.length,
    totalDays,
    totalDistanceKm: Math.round(totalDistanceKm),
    totalDistanceMi: Math.round(totalDistanceKm * 0.621371),
    countries: countriesList,
    cities: citiesList,
  };
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const yearParam = searchParams.get("year");
  const year = yearParam ? parseInt(yearParam) : null;

  // Include trips the user owns + trips they're marked "going on" as a participant
  const goingOnTripIds = await db
    .select({ tripId: participants.tripId })
    .from(participants)
    .where(
      and(
        or(
          eq(participants.userId, session.user.id),
          eq(participants.email, session.user.email)
        ),
        eq(participants.isGoingOnTrip, 1)
      )
    );

  const sharedTripIdSet = new Set(goingOnTripIds.map((r) => r.tripId));

  const allTrips = await db.select().from(trips).where(eq(trips.ownerId, session.user.id));
  const sharedTrips = sharedTripIdSet.size > 0
    ? await db.select().from(trips).where(
        or(...[...sharedTripIdSet].map((id) => eq(trips.id, id)))
      )
    : [];

  // Merge without duplicates (owner might also be a participant on their own trip)
  const tripMap = new Map([...allTrips, ...sharedTrips].map((t) => [t.id, t]));
  const mergedTrips = [...tripMap.values()];

  const allItems = await db.select().from(itineraryItems).where(eq(itineraryItems.isDraft, 0));

  // Filter items to only those belonging to included trips
  const tripIds = new Set(mergedTrips.map((t) => t.id));
  const userItems = allItems.filter((i) => tripIds.has(i.tripId));

  // Get available years for the filter dropdown
  const years = [
    ...new Set(
      mergedTrips.map((t) => new Date(t.startDate + "T00:00:00Z").getUTCFullYear())
    ),
  ].sort((a, b) => b - a);

  const stats = computeStats(mergedTrips, userItems, year);

  return NextResponse.json({ ...stats, years });
}
