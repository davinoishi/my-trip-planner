"use client";

import { useState, useEffect, useRef } from "react";
import Map, { Marker, Popup, NavigationControl, Source, Layer } from "react-map-gl/mapbox";
import type { LayerProps, MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { Plane, Hotel, Car, Train, Zap, ArrowRight, StickyNote } from "lucide-react";
import type { RouterOutputs } from "@/lib/trpc";
import { getAirportCoords } from "@/lib/airports";

type ApiItineraryItem = RouterOutputs["itineraryItems"]["list"][number];

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

const TYPE_COLOR: Record<string, string> = {
  flight:     "#3b82f6",
  hotel:      "#8b5cf6",
  car_rental: "#f59e0b",
  train:      "#10b981",
  activity:   "#ec4899",
  transfer:   "#6b7280",
  note:       "#9ca3af",
};

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  flight:     Plane,
  hotel:      Hotel,
  car_rental: Car,
  train:      Train,
  activity:   Zap,
  transfer:   ArrowRight,
  note:       StickyNote,
};

interface PinnedItem {
  item: ApiItineraryItem;
  lng: number;
  lat: number;
}

interface FlightRoute {
  item: ApiItineraryItem;
  from: [number, number]; // [lng, lat]
  to: [number, number];
}

/**
 * Computes great-circle waypoints between two [lng, lat] coordinates.
 * Normalizes longitudes so Mapbox doesn't wrap the wrong way across the antimeridian.
 */
function greatCircleCoords(
  from: [number, number],
  to: [number, number],
  steps = 64
): [number, number][] {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const [lng1, lat1] = [toRad(from[0]), toRad(from[1])];
  const [lng2, lat2] = [toRad(to[0]), toRad(to[1])];

  // Angular distance using haversine
  const d = 2 * Math.asin(Math.sqrt(
    Math.pow(Math.sin((lat2 - lat1) / 2), 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin((lng2 - lng1) / 2), 2)
  ));
  if (d === 0) return [from, to];

  // Spherical interpolation via 3-D Cartesian slerp
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2);
    const y = A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    pts.push([toDeg(Math.atan2(y, x)), toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)))]);
  }

  // Normalize longitudes: keep each point within 180° of its predecessor so
  // Mapbox draws the line in the correct direction across the antimeridian.
  const out: [number, number][] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    let lng = pts[i][0];
    const prev = out[i - 1][0];
    while (lng - prev > 180) lng -= 360;
    while (lng - prev < -180) lng += 360;
    out.push([lng, pts[i][1]]);
  }
  return out;
}

/** Detect a plain "lat, lng" decimal coordinate string and return [lng, lat] for Mapbox. */
function parseLngLat(query: string): [number, number] | null {
  const match = query.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = parseFloat(match[1]!);
  const lng = parseFloat(match[2]!);
  if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return [lng, lat];
  return null;
}

/**
 * Parse DMS (degrees/minutes/seconds) coordinate strings.
 * Handles formats like:
 *   31° 14' 24.19" N    121° 29' 43.8" E
 *   31°14'24.19"N 121°29'43.8"E
 */
function parseDMS(query: string): [number, number] | null {
  const dms = /(\d+)\s*[°d]\s*(\d+)\s*['''′]\s*(\d+(?:[.,]\d+)?)\s*["""″]?\s*([NS])\s+(\d+)\s*[°d]\s*(\d+)\s*['''′]\s*(\d+(?:[.,]\d+)?)\s*["""″]?\s*([EW])/i;
  const m = query.trim().match(dms);
  if (!m) return null;
  const lat = (parseFloat(m[1]!) + parseFloat(m[2]!) / 60 + parseFloat(m[3]!.replace(",", ".")) / 3600)
    * (m[4]!.toUpperCase() === "S" ? -1 : 1);
  const lng = (parseFloat(m[5]!) + parseFloat(m[6]!) / 60 + parseFloat(m[7]!.replace(",", ".")) / 3600)
    * (m[8]!.toUpperCase() === "W" ? -1 : 1);
  if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return [lng, lat];
  return null;
}

/**
 * Detect ISO 3166-1 alpha-2 country code from address text.
 * Used to restrict Mapbox results to the correct country.
 */
const COUNTRY_HINTS: Array<[RegExp, string]> = [
  [/\bchina\b|中国|上海|北京|广州|深圳|成都|杭州|武汉|重庆|浦东|黄浦|徐汇|宝山/i, "CN"],
  [/\bjapan\b|日本|東京|大阪|京都|osaka|tokyo|kyoto/i, "JP"],
  [/\bsouth korea\b|\bkorea\b|한국|서울|부산|seoul|busan/i, "KR"],
  [/\btaiwan\b|台湾|台灣|台北|taipei/i, "TW"],
  [/\bfrance\b|paris|lyon|marseille/i, "FR"],
  [/\bgermany\b|deutschland|berlin|munich|münchen|frankfurt/i, "DE"],
  [/\bitaly\b|italia|rome|milan|roma|milano/i, "IT"],
  [/\bspain\b|españa|madrid|barcelona/i, "ES"],
  [/\b(uk|united kingdom|england|britain)\b|london|manchester|edinburgh/i, "GB"],
];

function detectCountry(address: string): string | null {
  for (const [pattern, code] of COUNTRY_HINTS) {
    if (pattern.test(address)) return code;
  }
  return null;
}

/**
 * Clean an address before geocoding:
 * - Strip postal code labels (邮政编码, ZIP, Postal Code, …)
 *   Note: no \b before CJK — \b only works for ASCII word boundaries
 * - Expand single-letter direction codes in parens: (M)→Middle, (E)→East, etc.
 * - Strip remaining parenthetical qualifiers like (E-1), (Section 2)
 */
function cleanAddress(raw: string): string {
  const DIRECTION: Record<string, string> = { E: "East", W: "West", N: "North", S: "South", M: "Middle" };
  return raw
    .replace(/(postal\s*code|zip\s*code?|postcode|邮政编码|郵政編碼|〒)\s*:?\s*[\d\s-]{3,10}/gi, "")
    .replace(/\s*\(([EWNSM])\)/gi, (_, d: string) => " " + (DIRECTION[d.toUpperCase()] ?? d))
    .replace(/\s*\([^)]{1,40}\)/g, "")
    // Normalize spaced house numbers in CJK context: "8 8号" → "88号"
    // Must run before collapsing spaces so the pattern is still detectable
    .replace(/(\d)\s+(\d+(?:号|条|弄|路|街|道|巷))/g, "$1$2")
    .replace(/,\s*,/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/,\s*$/, "");
}

/**
 * For comma-delimited addresses with 4+ components, keep only
 * street + last 2 meaningful parts (city + country).
 * Drops ambiguous intermediate neighborhoods/districts that
 * exist in multiple cities (e.g. "Huangpu" is in both Shanghai and Guangzhou).
 */
function simplifyAddress(cleaned: string): string | null {
  const parts = cleaned.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length < 4) return null;
  const meaningful = parts.filter((p) => !/^[\d\s-]+$/.test(p));
  if (meaningful.length < 3) return null;
  return [meaningful[0]!, ...meaningful.slice(-2)].join(", ");
}

/**
 * For Chinese addresses without commas, build progressively simpler
 * fallback queries by stripping building names, normalizing spaced
 * house numbers, and ultimately falling back to street or district alone.
 */
function buildChineseFallbacks(cleaned: string): string[] {
  const fallbacks: string[] = [];

  // Strip building/mall/shop suffix after street number
  // "世纪大道 8 8号上海国金中心商场1层" → "世纪大道 8 8号"
  const withoutBuilding = cleaned
    .replace(/(号)\s*[\u4e00-\u9fff][\u4e00-\u9fff\w]*(商场|广场|中心|大厦|大楼|购物|酒店|饭店)\S*/g, "$1")
    .replace(/\d+\s*[层楼]/g, "")
    .trim();
  if (withoutBuilding !== cleaned) fallbacks.push(withoutBuilding);

  // Normalize spaced house numbers: "8 8号" → "88号"
  const normalized = (withoutBuilding !== cleaned ? withoutBuilding : cleaned)
    .replace(/(\d)\s+(\d+号)/g, "$1$2");
  if (normalized !== (withoutBuilding !== cleaned ? withoutBuilding : cleaned)) fallbacks.push(normalized);

  // Strip house number entirely: "世纪大道 88号" → "世纪大道"
  // Gives just the street name which Mapbox reliably geocodes
  const noNumber = normalized.replace(/\s*\d+号/, "").replace(/\s{2,}/g, " ").trim();
  if (noNumber && noNumber !== normalized) fallbacks.push(noNumber);

  // Last resort: just city + district (first 2 space-separated tokens)
  const tokens = cleaned.split(/\s+/);
  if (tokens.length > 2) fallbacks.push(tokens.slice(0, 2).join(" "));

  return [...new Set(fallbacks)];
}

/**
 * broad=true removes the types restriction so neighborhood/locality
 * results (e.g. "Lujiazui") are also returned — used for fallback queries.
 */
async function geocodeQuery(q: string, country?: string, broad = false): Promise<[number, number] | null> {
  try {
    const params = new URLSearchParams({ access_token: MAPBOX_TOKEN, limit: "1" });
    if (!broad) params.set("types", "address,place,poi");
    if (country) params.set("country", country);
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?${params}`
    );
    const data = await res.json();
    const center = data.features?.[0]?.center;
    return center ?? null;
  } catch {
    return null;
  }
}

async function geocode(query: string): Promise<[number, number] | null> {
  const direct = parseLngLat(query) ?? parseDMS(query);
  if (direct) return direct;

  const cleaned = cleanAddress(query);
  const country = detectCountry(query) ?? undefined;
  const hasCJK = /[\u4e00-\u9fff]/.test(cleaned);

  // "Venue, CJK address" — activity items combine venue name + address with a comma.
  // When CJK chars appear after the first comma, extract the CJK portion and geocode
  // it through the CJK-specific fallback chain rather than the Western comma path.
  const commaParts = cleaned.split(",").map((s) => s.trim()).filter(Boolean);
  const cjkAfterComma = commaParts.length >= 2 && /[\u4e00-\u9fff]/.test(commaParts.slice(1).join(""));

  if (hasCJK && (cjkAfterComma || !cleaned.includes(","))) {
    // Use the CJK address portion only (drop any prepended Western venue name)
    const cjkPart = cjkAfterComma
      ? commaParts.slice(1).join(" ").trim()
      : cleaned;

    for (const candidate of [cjkPart, ...buildChineseFallbacks(cjkPart)]) {
      const broad = candidate.split(/\s+/).length <= 2;
      const r = await geocodeQuery(candidate, country, broad);
      if (r) return r;
    }
    return null;
  }

  // Comma-delimited Western format:
  // 1. Simplified (street + city + country) — avoids ambiguous middle districts
  const simplified = simplifyAddress(cleaned);
  if (simplified) {
    const r = await geocodeQuery(simplified, country);
    if (r) return r;
    // Without street number (e.g. "Yincheng Rd" instead of "501 Yincheng Rd")
    const noNum = simplified.replace(/^\d[\d-]*\s+/, "");
    if (noNum !== simplified) {
      const r2 = await geocodeQuery(noNum, country);
      if (r2) return r2;
    }
  }

  // 2. Full cleaned address
  const result = await geocodeQuery(cleaned, country);
  if (result) return result;

  // 3. Drop street — use area/neighborhood (broad so locality types match)
  const parts = cleaned.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length > 1) {
    return geocodeQuery(parts.slice(1).join(", "), country, true);
  }
  return null;
}

function getLocationQuery(item: ApiItineraryItem): string | null {
  const d = item.details as Record<string, string> | null;
  if (!d) return null;
  switch (item.type) {
    case "hotel":
      return [d.address, d.hotelName].filter(Boolean).join(", ") || null;
    case "activity":
      return [d.venue, d.address].filter(Boolean).join(", ") || null;
    case "car_rental":
      return d.pickupLocation || null;
    case "transfer":
      return d.pickupLocation || null;
    case "train":
      return d.departureStation || null;
    default:
      return null;
  }
}

function getFlightAirports(item: ApiItineraryItem): [string, string] | null {
  const d = item.details as Record<string, string> | null;
  if (item.type === "flight" && d?.departureAirport && d?.arrivalAirport) {
    return [d.departureAirport, d.arrivalAirport];
  }
  return null;
}


const routeLayerStyle: LayerProps = {
  id: "route-lines",
  type: "line",
  paint: {
    "line-color": "#3b82f6",
    "line-width": 2,
    "line-dasharray": [2, 2],
  },
};

/** Compute a synchronous initial center from the first resolvable airport in the items. */
function getInitialViewState(items: ApiItineraryItem[]) {
  for (const item of items) {
    if (item.isDraft) continue;
    const airports = getFlightAirports(item);
    if (airports) {
      const coords = getAirportCoords(airports[0]) ?? getAirportCoords(airports[1]);
      if (coords) return { longitude: coords[0], latitude: coords[1], zoom: 4 };
    }
  }
  return { longitude: 0, latitude: 20, zoom: 1.5 };
}

export function TripMap({ items }: { items: ApiItineraryItem[] }) {
  const mapRef = useRef<MapRef>(null);
  const [pins, setPins] = useState<PinnedItem[]>([]);
  const [routes, setRoutes] = useState<FlightRoute[]>([]);
  const [selected, setSelected] = useState<PinnedItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function geocodeAll() {
      setLoading(true);
      const newPins: PinnedItem[] = [];
      const newRoutes: FlightRoute[] = [];

      for (const item of items) {
        if (item.isDraft) continue;

        const airports = getFlightAirports(item);
        if (airports) {
          const [fromCode, toCode] = airports;
          const [from, to] = await Promise.all([
            Promise.resolve(getAirportCoords(fromCode) ?? null).then(c => c ?? geocode(`${fromCode} international airport`)),
            Promise.resolve(getAirportCoords(toCode) ?? null).then(c => c ?? geocode(`${toCode} international airport`)),
          ]);
          if (from && to) {
            newRoutes.push({ item, from, to });
            newPins.push({ item, lng: from[0], lat: from[1] });
            newPins.push({ item: { ...item, title: toCode }, lng: to[0], lat: to[1] });
          }
          continue;
        }

        const query = getLocationQuery(item);
        if (!query) continue;
        const coords = await geocode(query);
        if (coords) {
          newPins.push({ item, lng: coords[0], lat: coords[1] });
        }
      }

      if (!cancelled) {
        setPins(newPins);
        setRoutes(newRoutes);

        // Issue #1: fly/fit to pins after geocoding instead of relying on initial viewState
        if (newPins.length > 0) {
          const map = mapRef.current;
          if (map) {
            const lngs = newPins.map((p) => p.lng);
            const lats = newPins.map((p) => p.lat);
            if (newPins.length === 1) {
              map.flyTo({ center: [newPins[0]!.lng, newPins[0]!.lat], zoom: 12, duration: 800 });
            } else {
              map.fitBounds(
                [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
                { padding: 80, maxZoom: 12, duration: 800 }
              );
            }
          }
        }
        setLoading(false);
      }
    }

    geocodeAll();
    return () => { cancelled = true; };
  }, [items]);

  const routeGeoJSON = {
    type: "FeatureCollection" as const,
    features: routes.map((r) => ({
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: greatCircleCoords(r.from, r.to),
      },
    })),
  };

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-gray-100" style={{ height: 600 }}>
      <Map
        ref={mapRef}
        initialViewState={getInitialViewState(items)}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        mapboxAccessToken={MAPBOX_TOKEN}
      >
        <NavigationControl position="top-right" />

        {routes.length > 0 && (
          <Source id="routes" type="geojson" data={routeGeoJSON}>
            <Layer {...routeLayerStyle} />
          </Source>
        )}

        {pins.map((pin, i) => {
          const color = TYPE_COLOR[pin.item.type] ?? "#6b7280";
          const Icon = TYPE_ICON[pin.item.type];
          return (
            <Marker
              key={`${pin.item.id}-${i}`}
              longitude={pin.lng}
              latitude={pin.lat}
              anchor="bottom"
              onClick={(e: { originalEvent: MouseEvent }) => {
                e.originalEvent.stopPropagation();
                setSelected(selected?.item.id === pin.item.id && selected.lng === pin.lng ? null : pin);
              }}
            >
              <div
                className="flex items-center justify-center w-8 h-8 rounded-full shadow-md cursor-pointer hover:scale-110 transition-transform border-2 border-white"
                style={{ backgroundColor: color }}
              >
                {Icon && <Icon className="w-4 h-4 text-white" />}
              </div>
            </Marker>
          );
        })}

        {selected && (
          <Popup
            longitude={selected.lng}
            latitude={selected.lat}
            anchor="top"
            onClose={() => setSelected(null)}
            closeButton
            closeOnClick={false}
            offset={12}
          >
            <div className="min-w-[160px] p-1">
              <p className="font-semibold text-sm text-gray-900 leading-snug">{selected.item.title}</p>
              <p className="text-xs text-gray-400 mt-0.5 capitalize">
                {selected.item.type.replace("_", " ")}
              </p>
              {selected.item.startTime && (
                <p className="text-xs text-gray-500 mt-1">{selected.item.startTime}</p>
              )}
            </div>
          </Popup>
        )}
      </Map>

      {/* Empty state overlay */}
      {!loading && pins.length === 0 && routes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 pointer-events-none">
          <p className="text-gray-400 text-sm text-center px-8">
            No locations to show — add addresses or airport codes to your itinerary items
          </p>
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 pointer-events-none">
          <p className="text-gray-400 text-sm">Locating stops…</p>
        </div>
      )}
    </div>
  );
}
