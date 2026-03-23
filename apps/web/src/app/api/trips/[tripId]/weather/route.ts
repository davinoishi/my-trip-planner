import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, trips, itineraryItems, participants } from "@trip/db";
import { eq, and } from "drizzle-orm";
import { AIRPORT_COORDS, AIRPORT_CITIES } from "@/lib/airports";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ResolvedLocation {
  name: string;
  iata?: string;
  lat: number;
  lon: number;
  fromDate: string;
  toDate: string;
}

export interface LocationWeather {
  name: string;
  iata?: string;
  fromDate: string;
  toDate: string;
  avgHighC: number;
  avgLowC: number;
  avgHighF: number;
  avgLowF: number;
  avgPrecipMm: number;
  avgSnowCm: number;
  avgWindKph: number;
  alerts: string[];
  dataYear: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function toF(c: number) {
  return Math.round((c * 9) / 5 + 32);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function avg(arr: (number | null)[]): number {
  const valid = arr.filter((v): v is number => v !== null && !isNaN(v));
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

function getMonths(startDate: string, endDate: string): number[] {
  const months = new Set<number>();
  const d = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");
  while (d <= end) {
    months.add(d.getUTCMonth() + 1);
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return Array.from(months);
}

function getSeasonalAlerts(lat: number, lon: number, months: number[]): string[] {
  const has = (lo: number, hi: number) => months.some((m) => m >= lo && m <= hi);
  const hasWrap = (lo: number, hi: number) => months.some((m) => m >= lo || m <= hi);
  const alerts: string[] = [];

  // Atlantic / Caribbean hurricanes
  if (lat >= 8 && lat <= 32 && lon >= -100 && lon <= -45 && has(6, 11)) {
    alerts.push("🌀 Atlantic hurricane season (Jun–Nov)");
  }
  // Eastern Pacific hurricanes (Mexico/Central America Pacific coast)
  if (lat >= 8 && lat <= 30 && lon >= -120 && lon <= -85 && has(5, 11)) {
    alerts.push("🌀 Eastern Pacific hurricane season (May–Nov)");
  }
  // Western Pacific typhoons
  if (lat >= 0 && lat <= 40 && lon >= 100 && lon <= 180 && has(5, 11)) {
    alerts.push("🌀 Western Pacific typhoon season (May–Nov)");
  }
  // South Indian Ocean cyclones
  if (lat >= -35 && lat <= -5 && lon >= 40 && lon <= 115 && hasWrap(11, 4)) {
    alerts.push("🌀 South Indian Ocean cyclone season (Nov–Apr)");
  }
  // Australian cyclones
  if (lat >= -25 && lat <= -10 && lon >= 110 && lon <= 160 && hasWrap(11, 4)) {
    alerts.push("🌀 Australian cyclone season (Nov–Apr)");
  }
  // South Asian monsoon
  if (lat >= 5 && lat <= 30 && lon >= 65 && lon <= 100 && has(6, 9)) {
    alerts.push("🌧️ South Asian monsoon season (Jun–Sep)");
  }
  // Southeast Asian monsoon
  if (lat >= 0 && lat <= 25 && lon >= 95 && lon <= 122 && has(5, 10)) {
    alerts.push("🌧️ Southeast Asian monsoon season (May–Oct)");
  }

  return alerts;
}

function extractCityFromAddress(address: string): string {
  if (!address) return "";
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return "";
  // Use last 2 parts for context (e.g., "Palm Beach, Aruba"), fallback to last 1
  return parts.slice(-Math.min(2, parts.length)).join(", ");
}

async function geocode(
  query: string
): Promise<{ name: string; latitude: number; longitude: number } | null> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
    const res = await fetch(url, { next: { revalidate: 86400 } }); // cache 24h
    if (!res.ok) return null;
    const data = await res.json() as { results?: Array<{ name: string; latitude: number; longitude: number }> };
    const r = data.results?.[0];
    return r ? { name: r.name, latitude: r.latitude, longitude: r.longitude } : null;
  } catch {
    return null;
  }
}

function extractLocations(
  tripStartDate: string,
  items: Array<{ type: string; dayIndex: number; details: unknown }>
): Array<{
  type: "airport" | "place";
  name: string;
  iata?: string;
  searchQuery?: string;
  lat?: number;
  lon?: number;
  fromDate: string;
  toDate: string;
}> {
  const candidates: ReturnType<typeof extractLocations> = [];

  for (const item of items) {
    const d = (item.details ?? {}) as Record<string, unknown>;
    const itemDate = addDays(tripStartDate, item.dayIndex);

    if (item.type === "flight") {
      type Leg = {
        departureAirport?: string;
        arrivalAirport?: string;
        departureDate?: string;
        arrivalDate?: string;
        date?: string;
      };
      const legs =
        (d.legs ?? d.segments ?? d.flights) as Leg[] | undefined;

      if (legs?.length) {
        for (const leg of legs) {
          const depDate = leg.departureDate ?? leg.date ?? itemDate;
          const arrDate = leg.arrivalDate ?? depDate;
          if (leg.departureAirport) {
            const iata = leg.departureAirport;
            const coords = AIRPORT_COORDS[iata];
            candidates.push({
              type: "airport",
              name: AIRPORT_CITIES[iata] ?? iata,
              iata,
              lat: coords?.[1],
              lon: coords?.[0],
              fromDate: depDate,
              toDate: depDate,
            });
          }
          if (leg.arrivalAirport) {
            const iata = leg.arrivalAirport;
            const coords = AIRPORT_COORDS[iata];
            candidates.push({
              type: "airport",
              name: AIRPORT_CITIES[iata] ?? iata,
              iata,
              lat: coords?.[1],
              lon: coords?.[0],
              fromDate: arrDate,
              toDate: arrDate,
            });
          }
        }
      } else {
        // Single-leg flight
        for (const [airportKey, dateKey] of [
          ["departureAirport", "departureDate"],
          ["arrivalAirport", "arrivalDate"],
        ] as const) {
          const iata = d[airportKey] as string | undefined;
          if (iata) {
            const coords = AIRPORT_COORDS[iata];
            const date = (d[dateKey] as string | undefined) ?? itemDate;
            candidates.push({
              type: "airport",
              name: AIRPORT_CITIES[iata] ?? iata,
              iata,
              lat: coords?.[1],
              lon: coords?.[0],
              fromDate: date,
              toDate: date,
            });
          }
        }
      }
    } else if (item.type === "hotel") {
      const address = (d.address as string) || (d.hotelName as string) || "";
      const city = extractCityFromAddress(address);
      if (city) {
        candidates.push({
          type: "place",
          name: city,
          searchQuery: city,
          fromDate: itemDate,
          toDate: itemDate,
        });
      }
    } else if (item.type === "activity" || item.type === "transfer") {
      const address = (d.address as string) || (d.venue as string) || "";
      const city = extractCityFromAddress(address);
      if (city) {
        candidates.push({
          type: "place",
          name: city,
          searchQuery: city,
          fromDate: itemDate,
          toDate: itemDate,
        });
      }
    }
  }

  return candidates;
}

async function resolveCoordinates(
  candidates: ReturnType<typeof extractLocations>
): Promise<ResolvedLocation[]> {
  const resolved: ResolvedLocation[] = [];

  for (const c of candidates) {
    if (c.lat !== undefined && c.lon !== undefined) {
      resolved.push({
        name: c.name,
        iata: c.iata,
        lat: c.lat,
        lon: c.lon,
        fromDate: c.fromDate,
        toDate: c.toDate,
      });
    } else if (c.searchQuery) {
      const geo = await geocode(c.searchQuery);
      if (geo) {
        resolved.push({
          name: geo.name,
          lat: geo.latitude,
          lon: geo.longitude,
          fromDate: c.fromDate,
          toDate: c.toDate,
        });
      }
    }
  }

  return resolved;
}

function deduplicateLocations(locations: ResolvedLocation[]): ResolvedLocation[] {
  const unique: ResolvedLocation[] = [];

  for (const loc of locations) {
    const existingIdx = unique.findIndex(
      (u) => distanceKm(u.lat, u.lon, loc.lat, loc.lon) < 50
    );
    if (existingIdx >= 0) {
      const existing = unique[existingIdx]!;
      // Expand date range
      if (loc.fromDate < existing.fromDate) existing.fromDate = loc.fromDate;
      if (loc.toDate > existing.toDate) existing.toDate = loc.toDate;
      // Prefer hotel/place city name over raw IATA municipality
      if (!loc.iata && existing.iata) {
        existing.name = loc.name;
      }
    } else {
      unique.push({ ...loc });
    }
  }

  // Sort by first appearance (fromDate)
  return unique.sort((a, b) => a.fromDate.localeCompare(b.fromDate));
}

async function fetchHistoricalWeather(
  loc: ResolvedLocation,
  tripStartDate: string,
  tripEndDate: string
): Promise<LocationWeather | null> {
  // Query the same calendar period one year prior
  const shift = (d: string, years: number) =>
    d.replace(/^\d{4}/, (y) => String(parseInt(y) + years));
  const histStart = shift(tripStartDate, -1);
  const histEnd = shift(tripEndDate, -1);

  const url =
    `https://archive-api.open-meteo.com/v1/archive` +
    `?latitude=${loc.lat.toFixed(4)}&longitude=${loc.lon.toFixed(4)}` +
    `&start_date=${histStart}&end_date=${histEnd}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,wind_speed_10m_max` +
    `&timezone=UTC`;

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = await res.json() as {
      daily?: {
        temperature_2m_max: (number | null)[];
        temperature_2m_min: (number | null)[];
        precipitation_sum: (number | null)[];
        snowfall_sum: (number | null)[];
        wind_speed_10m_max: (number | null)[];
      };
    };
    const daily = data.daily;
    if (!daily) return null;

    const avgHighC = Math.round(avg(daily.temperature_2m_max) * 10) / 10;
    const avgLowC = Math.round(avg(daily.temperature_2m_min) * 10) / 10;
    const months = getMonths(histStart, histEnd);

    return {
      name: loc.name,
      iata: loc.iata,
      fromDate: loc.fromDate,
      toDate: loc.toDate,
      avgHighC,
      avgLowC,
      avgHighF: toF(avgHighC),
      avgLowF: toF(avgLowC),
      avgPrecipMm: Math.round(avg(daily.precipitation_sum) * 10) / 10,
      avgSnowCm: Math.round(avg(daily.snowfall_sum) * 10) / 10,
      avgWindKph: Math.round(avg(daily.wind_speed_10m_max) * 10) / 10,
      alerts: getSeasonalAlerts(loc.lat, loc.lon, months),
      dataYear: new Date(histStart + "T00:00:00Z").getUTCFullYear(),
    };
  } catch {
    return null;
  }
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const trip = await db.query.trips.findFirst({ where: eq(trips.id, tripId) });
  if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (trip.ownerId !== session.user.id) {
    const participant = await db.query.participants.findFirst({
      where: and(
        eq(participants.tripId, tripId),
        eq(participants.email, session.user.email)
      ),
    });
    if (!participant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const items = await db
    .select()
    .from(itineraryItems)
    .where(and(eq(itineraryItems.tripId, tripId), eq(itineraryItems.isDraft, 0)));

  const candidates = extractLocations(trip.startDate, items);
  const withCoords = await resolveCoordinates(candidates);
  const unique = deduplicateLocations(withCoords);

  const results = await Promise.all(
    unique.map((loc) => fetchHistoricalWeather(loc, trip.startDate, trip.endDate))
  );

  return NextResponse.json(results.filter(Boolean));
}
