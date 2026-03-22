"use client";

import { use } from "react";
import { trpc } from "@/lib/trpc";
import { Timeline } from "@/components/itinerary/timeline";
import { AlertCircle } from "lucide-react";

interface ItineraryPageProps {
  params: Promise<{ tripId: string }>;
}

export default function ItineraryPage({ params }: ItineraryPageProps) {
  const { tripId } = use(params);
  const { data: trip, isLoading, error } = trpc.trips.getById.useQuery({ id: tripId });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-gray-400">
        Loading…
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-sm text-red-500 gap-2">
        <AlertCircle size={24} />
        Could not load trip.
      </div>
    );
  }

  return (
    <Timeline
      tripId={trip.id}
      startDate={trip.startDate}
      endDate={trip.endDate}
    />
  );
}
