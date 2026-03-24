"use client";

import { use, useEffect, useState } from "react";
import { Thermometer, Droplets, Snowflake, Wind, AlertTriangle, CloudSun } from "lucide-react";
import type { LocationWeather } from "@/app/api/trips/[tripId]/weather/route";

interface WeatherPageProps {
  params: Promise<{ tripId: string }>;
}

function formatDateRange(from: string, to: string): string {
  const fmt = (d: string) =>
    new Date(d + "T00:00:00Z").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  return from === to ? fmt(from) : `${fmt(from)} – ${fmt(to)}`;
}

function weatherSummary(w: LocationWeather): { emoji: string; label: string } {
  if (w.avgSnowCm > 0.5) return { emoji: "❄️", label: "Snowy" };
  if (w.avgHighC >= 28) return { emoji: "☀️", label: "Hot" };
  if (w.avgHighC >= 20) return { emoji: "⛅", label: "Warm" };
  if (w.avgHighC >= 10) return { emoji: "🌥️", label: "Cool" };
  return { emoji: "🌨️", label: "Cold" };
}

function WeatherCard({ w }: { w: LocationWeather }) {
  const { emoji, label } = weatherSummary(w);
  const isSnowy = w.avgSnowCm > 0.5;
  const isRainy = w.avgPrecipMm > 5;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">{emoji}</span>
            <h3 className="font-semibold text-gray-900 text-base">{w.name}</h3>
            {w.iata && (
              <span className="text-xs font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                {w.iata}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {formatDateRange(w.fromDate, w.toDate)}
          </p>
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap">
          {label} · {w.dataYear} data
        </span>
      </div>

      {/* Stats grid */}
      <div className="px-5 py-4 grid grid-cols-2 gap-x-8 gap-y-3">
        <div className="flex items-start gap-2">
          <Thermometer className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-400">Avg High</p>
            <p className="text-sm font-semibold text-gray-900">
              {w.avgHighC}°C
              <span className="text-gray-400 font-normal ml-1">/ {w.avgHighF}°F</span>
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Thermometer className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-400">Avg Low</p>
            <p className="text-sm font-semibold text-gray-900">
              {w.avgLowC}°C
              <span className="text-gray-400 font-normal ml-1">/ {w.avgLowF}°F</span>
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Droplets className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isRainy ? "text-blue-500" : "text-blue-300"}`} />
          <div>
            <p className="text-xs text-gray-400">Precipitation</p>
            <p className="text-sm font-semibold text-gray-900">
              {w.avgPrecipMm} mm/day
              {isRainy && <span className="text-blue-500 text-xs ml-1">(rainy)</span>}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Wind className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-400">Avg Wind</p>
            <p className="text-sm font-semibold text-gray-900">{w.avgWindKph} km/h</p>
          </div>
        </div>

        {isSnowy && (
          <div className="flex items-start gap-2 col-span-2">
            <Snowflake className="w-4 h-4 text-sky-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-400">Avg Snowfall</p>
              <p className="text-sm font-semibold text-gray-900">{w.avgSnowCm} cm/day</p>
            </div>
          </div>
        )}
      </div>

      {/* Seasonal alerts */}
      {w.alerts.length > 0 && (
        <div className="px-5 pb-4 space-y-1.5">
          {w.alerts.map((alert) => (
            <div
              key={alert}
              className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2"
            >
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              {alert}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WeatherPage({ params }: WeatherPageProps) {
  const { tripId } = use(params);
  const [data, setData] = useState<LocationWeather[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/trips/${tripId}/weather`)
      .then((r) => r.json())
      .then((d: unknown) => {
        if (Array.isArray(d)) setData(d as LocationWeather[]);
        else setError("Failed to load weather data");
      })
      .catch(() => setError("Failed to load weather data"))
      .finally(() => setLoading(false));
  }, [tripId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-5 w-48 bg-gray-100 rounded animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-44 bg-gray-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-500 text-sm py-8 justify-center">
        <AlertTriangle size={18} />
        {error}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <CloudSun className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm">No location data found for this trip.</p>
        <p className="text-xs mt-1">Add flights or hotels to see weather expectations.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Historical weather for each location on your trip, based on the same period last year.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {data.map((w) => (
          <WeatherCard key={w.iata ?? w.name} w={w} />
        ))}
      </div>
    </div>
  );
}

