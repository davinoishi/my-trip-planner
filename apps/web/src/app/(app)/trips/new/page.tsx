"use client";

import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { TripForm } from "@/components/trips/trip-form";
import type { CreateTripInput } from "@trip/shared";
import { ArrowLeft, Plane } from "lucide-react";
import Link from "next/link";

export default function NewTripPage() {
  const router = useRouter();
  const createTrip = trpc.trips.create.useMutation({
    onSuccess: (trip) => router.push(`/trips/${trip.id}`),
  });

  async function handleSubmit(data: CreateTripInput) {
    await createTrip.mutateAsync(data);
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back nav */}
      <Link
        href="/trips"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to trips
      </Link>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-100 flex items-center gap-3">
          <div className="bg-blue-50 p-2.5 rounded-xl">
            <Plane className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">New Trip</h1>
            <p className="text-sm text-gray-500">Fill in the details to create your itinerary</p>
          </div>
        </div>

        {/* Form */}
        <div className="px-8 py-6">
          {createTrip.error && (
            <div className="mb-5 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3">
              {createTrip.error.message}
            </div>
          )}
          <TripForm
            onSubmit={handleSubmit}
            onCancel={() => router.push("/trips")}
            submitLabel="Create Trip"
            isLoading={createTrip.isPending}
          />
        </div>
      </div>
    </div>
  );
}

