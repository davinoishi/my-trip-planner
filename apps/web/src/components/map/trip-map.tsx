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

async function geocodeQuery(q: string): Promise<[number, number] | null> {
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${MAPBOX_TOKEN}&limit=1&types=address,place,poi`
    );
    const data = await res.json();
    const center = data.features?.[0]?.center;
    return center ?? null;
  } catch {
    return null;
  }
}

async function geocode(query: string): Promise<[number, number] | null> {
  // Short-circuit for coordinate strings — no API call needed
  const direct = parseLngLat(query) ?? parseDMS(query);
  if (direct) return direct;

  // Issue #3: try full query first, then fall back to the address portion alone
  const result = await geocodeQuery(query);
  if (result) return result;

  // Fallback: strip leading non-address tokens (e.g. venue name before the comma)
  const parts = query.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length > 1) {
    return geocodeQuery(parts.slice(1).join(", "));
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
