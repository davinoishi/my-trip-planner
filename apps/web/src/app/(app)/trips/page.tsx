"use client";

import { trpc } from "@/lib/trpc";
import Link from "next/link";
import { Plus, Plane, Calendar } from "lucide-react";

export default function TripsPage() {
  const { data: trips, isLoading } = trpc.trips.list.useQuery();

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="h-8 bg-gray-200 rounded w-48 mb-6 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-gray-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Trips</h1>
        <Link
          href="/trips/new"
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Trip
        </Link>
      </div>

      {!trips?.length ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
          <div className="bg-blue-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Plane className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-800 mb-1">No trips yet</h2>
          <p className="text-gray-500 text-sm mb-6">
            Create your first trip to get started
          </p>
          <Link
            href="/trips/new"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create a trip
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {trips.map((trip) => (
            <Link
              key={trip.id}
              href={`/trips/${trip.id}`}
              className="bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-md hover:border-blue-100 transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="bg-blue-50 p-2.5 rounded-xl">
                  <Plane className="w-5 h-5 text-blue-600" />
                </div>
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${
                    trip.status === "planning"
                      ? "bg-yellow-50 text-yellow-700"
                      : trip.status === "confirmed"
                        ? "bg-green-50 text-green-700"
                        : trip.status === "completed"
                          ? "bg-gray-100 text-gray-600"
                          : "bg-red-50 text-red-600"
                  }`}
                >
                  {trip.status}
                </span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-blue-700 transition-colors">
                {trip.name}
              </h3>
              <div className="flex items-center gap-1.5 text-gray-500 text-xs">
                <Calendar className="w-3.5 h-3.5" />
                {trip.startDate} → {trip.endDate}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
