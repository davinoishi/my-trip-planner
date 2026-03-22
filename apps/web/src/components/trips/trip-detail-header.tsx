"use client";

import { trpc } from "@/lib/trpc";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, Globe, Copy, Archive, Trash2, MoreHorizontal } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { formatDate } from "@trip/shared";

export function TripDetailHeader({ tripId }: { tripId: string }) {
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data: trip, isLoading } = trpc.trips.getById.useQuery({ id: tripId });

  const archiveTrip = trpc.trips.archive.useMutation({
    onSuccess: () => {
      utils.trips.list.invalidate();
      utils.trips.getById.invalidate({ id: tripId });
    },
  });

  const deleteTrip = trpc.trips.delete.useMutation({
    onSuccess: () => {
      utils.trips.list.invalidate();
      router.push("/trips");
    },
  });

  const duplicateTrip = trpc.trips.duplicate.useMutation({
    onSuccess: (newTrip) => {
      utils.trips.list.invalidate();
      router.push(`/trips/${newTrip.id}`);
    },
  });

  if (isLoading) {
    return (
      <div className="pb-4 animate-pulse">
        <div className="h-4 w-24 bg-gray-200 rounded mb-3" />
        <div className="h-8 w-64 bg-gray-200 rounded mb-2" />
        <div className="h-4 w-48 bg-gray-200 rounded" />
      </div>
    );
  }

  if (!trip) return null;

  const menuItems = [
    {
      label: "Duplicate",
      icon: <Copy className="w-4 h-4" />,
      onClick: () => duplicateTrip.mutate({ id: tripId }),
    },
    {
      label: "Archive",
      icon: <Archive className="w-4 h-4" />,
      onClick: () => archiveTrip.mutate({ id: tripId }),
      disabled: trip.status === "archived",
    },
    {
      label: "Delete trip",
      icon: <Trash2 className="w-4 h-4" />,
      onClick: () => {
        if (confirm(`Delete "${trip.name}"? This cannot be undone.`)) {
          deleteTrip.mutate({ id: tripId });
        }
      },
      variant: "danger" as const,
    },
  ];

  return (
    <div className="pb-4">
      <Link
        href="/trips"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-3"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        All trips
      </Link>

      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{trip.name}</h1>
            <StatusBadge status={trip.status} />
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {formatDate(trip.startDate)} — {formatDate(trip.endDate)}
            </span>
            <span className="flex items-center gap-1.5">
              <Globe className="w-4 h-4" />
              {trip.timezone}
            </span>
          </div>

          {trip.description && (
            <p className="text-sm text-gray-600">{trip.description}</p>
          )}
        </div>

        <DropdownMenu
          trigger={
            <button className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          }
          items={menuItems}
        />
      </div>
    </div>
  );
}
