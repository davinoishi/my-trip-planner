import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, trips, itineraryItems, participants } from "@trip/db";
import { eq, and } from "drizzle-orm";
import { AIRPORT_COORDS } from "@/lib/airports";

export interface DayForecast {
  date: string;       // "YYYY-MM-DD"
  weathercode: number;
  maxTempC: number;
  minTempC: number;
  maxTempF: number;
  minTempF: number;
}

function toF(c: number) {
  return Math.round((c * 9) / 5 + 32);
}

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

  // Only return forecast for trips starting within the next 10 days or currently ongoing
  const todayMs = Date.now();
  const tripStart = new Date(trip.startDate + "T00:00:00Z").getTime();
  const tripEnd = new Date(trip.endDate + "T00:00:00Z").getTime() + 86400000; // inclusive
  const tenDaysMs = 10 * 86400000;

  const tripStartsWithin10Days = tripStart - todayMs <= tenDaysMs;
  const tripIsOngoing = tripStart <= todayMs && todayMs < tripEnd;

  if (!tripStartsWithin10Days && !tripIsOngoing) {
    return NextResponse.json({ forecasts: [] });
  }

  // Find destination lat/lon from flight items
  const items = await db
    .select()
    .from(itineraryItems)
    .where(and(eq(itineraryItems.tripId, tripId), eq(itineraryItems.isDraft, 0)));

  let lat: number | null = null;
  let lon: number | null = null;

  for (const item of items) {
    if (item.type !== "flight") continue;
    const d = (item.details ?? {}) as Record<string, unknown>;
    type Leg = { arrivalAirport?: string };
    const legs = (d.legs ?? d.segments ?? d.flights) as Leg[] | undefined;

    let iata: string | undefined;
    if (legs?.length) {
      iata = legs[legs.length - 1]?.arrivalAirport;
    } else {
      iata = d.arrivalAirport as string | undefined;
    }

    if (iata) {
      const coords = AIRPORT_COORDS[iata];
      if (coords) {
        lon = coords[0];
        lat = coords[1];
        break;
      }
    }
  }

  if (lat === null || lon === null) {
    return NextResponse.json({ forecasts: [] });
  }

  // Fetch Open-Meteo 10-day forecast
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", lat.toFixed(4));
  url.searchParams.set("longitude", lon.toFixed(4));
  url.searchParams.set("daily", "weathercode,temperature_2m_max,temperature_2m_min");
  url.searchParams.set("forecast_days", "10");
  url.searchParams.set("timezone", "auto");

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
    if (!res.ok) return NextResponse.json({ forecasts: [] });

    const data = await res.json() as {
      daily: {
        time: string[];
        weathercode: number[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
      };
    };

    const forecasts: DayForecast[] = data.daily.time.map((date, i) => ({
      date,
      weathercode: data.daily.weathercode[i] ?? 0,
      maxTempC: Math.round(data.daily.temperature_2m_max[i] ?? 0),
      minTempC: Math.round(data.daily.temperature_2m_min[i] ?? 0),
      maxTempF: toF(data.daily.temperature_2m_max[i] ?? 0),
      minTempF: toF(data.daily.temperature_2m_min[i] ?? 0),
    }));

    return NextResponse.json({ forecasts });
  } catch {
    return NextResponse.json({ forecasts: [] });
  }
}
