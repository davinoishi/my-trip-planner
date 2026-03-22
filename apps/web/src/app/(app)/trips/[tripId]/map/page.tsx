"use client";

import { use } from "react";
import { trpc } from "@/lib/trpc";
import { TripMap } from "@/components/map/trip-map";

interface MapPageProps {
  params: Promise<{ tripId: string }>;
}

export default function MapPage({ params }: MapPageProps) {
  const { tripId } = use(params);
  const { data: items = [], isLoading } = trpc.itineraryItems.list.useQuery({ tripId });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-gray-400">
        Loading…
      </div>
    );
  }

  return <TripMap items={items} />;
}
