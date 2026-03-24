"use client";

import { useEffect, useState } from "react";
import { Globe, Calendar, Plane, Map, Building2 } from "lucide-react";

interface StatsData {
  totalTrips: number;
  totalDays: number;
  totalDistanceKm: number;
  totalDistanceMi: number;
  countries: { code: string; name: string }[];
  cities: string[];
  years: number[];
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-xl ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        <p className="text-sm text-gray-500 mt-1">{label}</p>
      </div>
    </div>
  );
}

export default function StatsPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<number | "all">("all");

  useEffect(() => {
    setLoading(true);
    const url = year === "all" ? "/api/stats" : `/api/stats?year=${year}`;
    fetch(url)
      .then((r) => r.json())
      .then((d: StatsData) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [year]);

  const years = data?.years ?? [];

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Travel Stats</h1>
          <p className="text-sm text-gray-500 mt-0.5">A summary of your adventures</p>
        </div>

        {/* Year filter */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setYear("all")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              year === "all"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All time
          </button>
          {years.map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                year === y
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : !data ? (
        <p className="text-sm text-gray-400 text-center py-20">Could not load stats.</p>
      ) : (
        <>
          {/* Key metrics */}
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              icon={Plane}
              label="Total trips"
              value={data.totalTrips}
              color="bg-blue-50 text-blue-600"
            />
            <StatCard
              icon={Calendar}
              label="Days traveling"
              value={data.totalDays}
              color="bg-purple-50 text-purple-600"
            />
            <StatCard
              icon={Map}
              label="Distance traveled"
              value={data.totalDistanceKm.toLocaleString() + " km"}
              sub={data.totalDistanceMi.toLocaleString() + " mi"}
              color="bg-green-50 text-green-600"
            />
            <StatCard
              icon={Globe}
              label="Countries visited"
              value={data.countries.length}
              color="bg-orange-50 text-orange-600"
            />
          </div>

          {/* Countries list */}
          {data.countries.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="w-4 h-4 text-orange-500" />
                <h2 className="text-sm font-semibold text-gray-900">
                  Countries ({data.countries.length})
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {data.countries.map((c) => (
                  <span
                    key={c.code}
                    className="px-3 py-1 bg-orange-50 text-orange-700 text-sm rounded-full border border-orange-100"
                  >
                    {c.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Cities list */}
          {data.cities.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-4 h-4 text-blue-500" />
                <h2 className="text-sm font-semibold text-gray-900">
                  Cities visited ({data.cities.length})
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {data.cities.map((city) => (
                  <span
                    key={city}
                    className="px-3 py-1 bg-blue-50 text-blue-700 text-sm rounded-full border border-blue-100"
                  >
                    {city}
                  </span>
                ))}
              </div>
            </div>
          )}

          {data.totalTrips === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Plane className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No trips found{year !== "all" ? ` for ${year}` : ""}.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

