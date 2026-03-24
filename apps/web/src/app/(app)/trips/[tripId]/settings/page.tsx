"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { TripForm } from "@/components/trips/trip-form";
import type { CreateTripInput } from "@trip/shared";
import { Trash2, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SettingsPageProps {
  params: Promise<{ tripId: string }>;
}

export default function TripSettingsPage({ params }: SettingsPageProps) {
  const { tripId } = use(params);
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data: trip, isLoading } = trpc.trips.getById.useQuery({ id: tripId });

  const updateTrip = trpc.trips.update.useMutation({
    onSuccess: () => {
      utils.trips.getById.invalidate({ id: tripId });
      utils.trips.list.invalidate();
    },
  });

  const archiveTrip = trpc.trips.archive.useMutation({
    onSuccess: () => {
      utils.trips.getById.invalidate({ id: tripId });
      utils.trips.list.invalidate();
    },
  });

  const deleteTrip = trpc.trips.delete.useMutation({
    onSuccess: () => {
      utils.trips.list.invalidate();
      router.push("/trips");
    },
  });

  async function handleUpdate(data: CreateTripInput) {
    await updateTrip.mutateAsync({ id: tripId, data });
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-4 animate-pulse">
        <div className="h-64 bg-gray-100 rounded-2xl" />
      </div>
    );
  }

  if (!trip) return null;

  return (
    <div className="max-w-2xl space-y-6">
      {/* Edit form */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Trip Details</h2>
          <p className="text-sm text-gray-500 mt-0.5">Update your trip name, dates, and settings</p>
        </div>
        <div className="px-6 py-5">
          {updateTrip.isSuccess && (
            <div className="mb-5 bg-green-50 border border-green-100 text-green-700 text-sm rounded-xl px-4 py-3">
              Trip updated successfully
            </div>
          )}
          {updateTrip.error && (
            <div className="mb-5 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3">
              {updateTrip.error.message}
            </div>
          )}
          <TripForm
            defaultValues={{
              name: trip.name,
              description: trip.description ?? undefined,
              startDate: trip.startDate,
              endDate: trip.endDate,
              timezone: trip.timezone,
              status: trip.status,
            }}
            onSubmit={handleUpdate}
            submitLabel="Save Changes"
            isLoading={updateTrip.isPending}
          />
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-2xl border border-red-100 shadow-sm">
        <div className="px-6 py-5 border-b border-red-100">
          <h2 className="font-semibold text-red-700">Danger Zone</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          {/* Archive */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">Archive this trip</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Archived trips are hidden from the main list but not deleted.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              isLoading={archiveTrip.isPending}
              disabled={trip.status === "archived"}
              onClick={() => archiveTrip.mutate({ id: tripId })}
            >
              <Archive className="w-3.5 h-3.5" />
              Archive
            </Button>
          </div>

          <hr className="border-red-50" />

          {/* Delete */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">Delete this trip</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Permanently deletes the trip and all its itinerary items. This cannot be undone.
              </p>
            </div>
            <Button
              variant="danger"
              size="sm"
              isLoading={deleteTrip.isPending}
              onClick={() => {
                if (confirm(`Delete "${trip.name}"? This cannot be undone.`)) {
                  deleteTrip.mutate({ id: tripId });
                }
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

