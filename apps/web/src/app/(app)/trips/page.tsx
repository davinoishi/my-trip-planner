"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Plane, Calendar, Globe, MoreHorizontal, Copy, Archive, Trash2, GitMerge } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { formatDate } from "@trip/shared";
import type { RouterOutputs } from "@/lib/trpc";

// Use tRPC's serialized output type (dates come back as strings over JSON)
type TripItem = RouterOutputs["trips"]["list"][number];

export default function TripsPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: trips, isLoading } = trpc.trips.list.useQuery();

  // Merge dialog state
  const [mergeSource, setMergeSource] = useState<TripItem | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");

  const archiveTrip = trpc.trips.archive.useMutation({
    onSuccess: () => utils.trips.list.invalidate(),
  });

  const deleteTrip = trpc.trips.delete.useMutation({
    onSuccess: () => utils.trips.list.invalidate(),
  });

  const duplicateTrip = trpc.trips.duplicate.useMutation({
    onSuccess: (newTrip) => {
      utils.trips.list.invalidate();
      router.push(`/trips/${newTrip.id}`);
    },
  });

  const mergeTrip = trpc.trips.merge.useMutation({
    onSuccess: (target) => {
      utils.trips.list.invalidate();
      setMergeSource(null);
      router.push(`/trips/${target.id}`);
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="h-8 bg-gray-200 rounded w-48 mb-6 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 bg-gray-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const activeTrips = trips?.filter((t) => t.status !== "archived") ?? [];
  const archivedTrips = trips?.filter((t) => t.status === "archived") ?? [];

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Trips</h1>
        <Link href="/trips/new">
          <Button>
            <Plus className="w-4 h-4" />
            New Trip
          </Button>
        </Link>
      </div>

      {/* Empty state */}
      {!trips?.length && (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
          <div className="bg-blue-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Plane className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-800 mb-1">No trips yet</h2>
          <p className="text-gray-500 text-sm mb-6">Plan your first adventure</p>
          <Link href="/trips/new">
            <Button>
              <Plus className="w-4 h-4" />
              Create a trip
            </Button>
          </Link>
        </div>
      )}

      {/* Active trips */}
      {activeTrips.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Upcoming & Active</h2>
          <TripGrid
            trips={activeTrips}
            onArchive={(id) => archiveTrip.mutate({ id })}
            onDelete={(trip) => {
              if (confirm(`Delete "${trip.name}"? This cannot be undone.`)) {
                deleteTrip.mutate({ id: trip.id });
              }
            }}
            onDuplicate={(id) => duplicateTrip.mutate({ id })}
            onMerge={(trip) => { setMergeSource(trip); setMergeTargetId(""); }}
          />
        </section>
      )}

      {/* Archived trips */}
      {archivedTrips.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Archived</h2>
          <TripGrid
            trips={archivedTrips}
            onArchive={(id) => archiveTrip.mutate({ id })}
            onDelete={(trip) => {
              if (confirm(`Delete "${trip.name}"? This cannot be undone.`)) {
                deleteTrip.mutate({ id: trip.id });
              }
            }}
            onDuplicate={(id) => duplicateTrip.mutate({ id })}
            onMerge={(trip) => { setMergeSource(trip); setMergeTargetId(""); }}
          />
        </section>
      )}

      {/* Merge Dialog */}
      <Dialog
        open={!!mergeSource}
        onClose={() => setMergeSource(null)}
        title="Merge Trips"
        description={`Move all items from "${mergeSource?.name}" into another trip, then delete it.`}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Merge into</label>
            <Select
              value={mergeTargetId}
              onChange={(e) => setMergeTargetId(e.target.value)}
            >
              <option value="">Select a trip…</option>
              {trips
                ?.filter((t) => t.id !== mergeSource?.id)
                .map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
            </Select>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setMergeSource(null)}>Cancel</Button>
            <Button
              variant="danger"
              isLoading={mergeTrip.isPending}
              disabled={!mergeTargetId}
              onClick={() => {
                if (mergeSource && mergeTargetId) {
                  mergeTrip.mutate({ sourceId: mergeSource.id, targetId: mergeTargetId });
                }
              }}
            >
              Merge & Delete source
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

interface TripGridProps {
  trips: TripItem[];
  onArchive: (id: string) => void;
  onDelete: (trip: TripItem) => void;
  onDuplicate: (id: string) => void;
  onMerge: (trip: TripItem) => void;
}

function TripGrid({ trips, onArchive, onDelete, onDuplicate, onMerge }: TripGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {trips.map((trip) => (
        <TripCard
          key={trip.id}
          trip={trip}
          onArchive={() => onArchive(trip.id)}
          onDelete={() => onDelete(trip)}
          onDuplicate={() => onDuplicate(trip.id)}
          onMerge={() => onMerge(trip)}
        />
      ))}
    </div>
  );
}

function TripCard({
  trip,
  onArchive,
  onDelete,
  onDuplicate,
  onMerge,
}: {
  trip: TripItem;
  onArchive: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMerge: () => void;
}) {
  const menuItems = [
    { label: "Duplicate",    icon: <Copy className="w-4 h-4" />,    onClick: onDuplicate },
    { label: "Merge into…",  icon: <GitMerge className="w-4 h-4" />, onClick: onMerge },
    { label: "Archive",      icon: <Archive className="w-4 h-4" />,  onClick: onArchive, disabled: trip.status === "archived" },
    { label: "Delete",       icon: <Trash2 className="w-4 h-4" />,   onClick: onDelete, variant: "danger" as const },
  ];

  return (
    <div className="group relative bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-md hover:border-blue-100 transition-all">
      {/* Actions kebab — shown on hover */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu
          trigger={
            <button className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          }
          items={menuItems}
        />
      </div>

      <Link href={`/trips/${trip.id}`} className="block">
        <div className="flex items-start justify-between mb-3">
          <div className="bg-blue-50 p-2.5 rounded-xl">
            <Plane className="w-5 h-5 text-blue-600" />
          </div>
          <StatusBadge status={trip.status} />
        </div>

        <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-blue-700 transition-colors pr-8">
          {trip.name}
        </h3>

        {trip.description && (
          <p className="text-xs text-gray-500 mb-2 line-clamp-2">{trip.description}</p>
        )}

        <div className="space-y-1.5 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
            {formatDate(trip.startDate)} — {formatDate(trip.endDate)}
          </div>
          <div className="flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 flex-shrink-0" />
            {trip.timezone}
          </div>
        </div>
      </Link>
    </div>
  );
}
