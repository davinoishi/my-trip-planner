"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Plane, Calendar, MoreHorizontal, Copy, Archive, Trash2, GitMerge } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { formatDate } from "@trip/shared";
import type { RouterOutputs } from "@/lib/trpc";

// ── Card visual helpers ────────────────────────────────────────────────────────

const CARD_GRADIENTS = [
  "from-sky-400 to-blue-500",
  "from-emerald-400 to-teal-500",
  "from-orange-400 to-rose-500",
  "from-violet-400 to-purple-500",
  "from-amber-400 to-orange-500",
  "from-pink-400 to-fuchsia-500",
  "from-cyan-400 to-sky-500",
  "from-green-400 to-emerald-600",
];

function cardGradient(name: string): string {
  let h = 0;
  for (const c of name) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  return CARD_GRADIENTS[Math.abs(h) % CARD_GRADIENTS.length]!;
}

function tripEmoji(name: string, description?: string | null): string {
  const t = `${name} ${description ?? ""}`.toLowerCase();
  if (/reef|great barrier|coral|snorkel|dive|diving|underwater/.test(t)) return "🤿";
  if (/beach|island|caribbean|aruba|bahamas|maldives|hawaii|cancun|bali|riviera/.test(t)) return "🏖️";
  if (/ski|snowboard|alpine|aspen|whistler|vail|chamonix|powder/.test(t)) return "⛷️";
  if (/safari|africa|kenya|tanzania|serengeti/.test(t)) return "🦁";
  if (/australia|cairns|sydney|melbourne|brisbane|perth|adelaide/.test(t)) return "🦘";
  if (/cruise|ship|sailing|yacht/.test(t)) return "🚢";
  if (/japan|tokyo|kyoto|osaka/.test(t)) return "⛩️";
  if (/china|shanghai|shenzhen|beijing|guangzhou|chengdu|hong kong|macau/.test(t)) return "🏯";
  if (/paris|france|eiffel/.test(t)) return "🗼";
  if (/rome|italy|italian|colosseum/.test(t)) return "🏛️";
  if (/new york|nyc|manhattan/.test(t)) return "🗽";
  if (/london|england|britain/.test(t)) return "🎡";
  if (/hike|trek|mountain|climbing/.test(t)) return "🏔️";
  if (/camping|camp|glamping/.test(t)) return "⛺";
  if (/road trip|drive|driving/.test(t)) return "🚗";
  if (/wedding|honeymoon/.test(t)) return "💍";
  if (/business|conference|work|summit/.test(t)) return "💼";
  if (/disney|theme park|universal/.test(t)) return "🎠";
  if (/spa|wellness|retreat/.test(t)) return "🧖";
  if (/food|culinary|wine|tasting/.test(t)) return "🍷";
  return "✈️";
}

function CountdownChip({ startDate, endDate }: { startDate: string; endDate: string }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  const daysToStart = Math.round((start.getTime() - today.getTime()) / 86400000);
  const daysToEnd = Math.round((end.getTime() - today.getTime()) / 86400000);

  if (daysToStart > 0 && daysToStart <= 60) {
    return (
      <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full whitespace-nowrap">
        {daysToStart === 1 ? "Tomorrow" : `In ${daysToStart} days`}
      </span>
    );
  }
  if (daysToStart <= 0 && daysToEnd >= 0) {
    return (
      <span className="text-[11px] font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
        Ongoing
      </span>
    );
  }
  if (daysToEnd < 0 && daysToEnd >= -14) {
    return (
      <span className="text-[11px] font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full whitespace-nowrap">
        {Math.abs(daysToEnd) === 1 ? "Yesterday" : `${Math.abs(daysToEnd)}d ago`}
      </span>
    );
  }
  return null;
}

function tripDuration(startDate: string, endDate: string): string {
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  return days === 1 ? "1 day" : `${days} days`;
}

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
  const gradient = cardGradient(trip.name);
  const emoji = tripEmoji(trip.name, trip.description);
  const duration = tripDuration(trip.startDate, trip.endDate);

  const menuItems = [
    { label: "Duplicate",    icon: <Copy className="w-4 h-4" />,     onClick: onDuplicate },
    { label: "Merge into…",  icon: <GitMerge className="w-4 h-4" />, onClick: onMerge },
    { label: "Archive",      icon: <Archive className="w-4 h-4" />,  onClick: onArchive, disabled: trip.status === "archived" },
    { label: "Delete",       icon: <Trash2 className="w-4 h-4" />,   onClick: onDelete, variant: "danger" as const },
  ];

  return (
    <div className="group relative bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-lg hover:border-transparent transition-all duration-200">
      {/* Kebab menu — rendered outside Link to avoid nested interactive elements */}
      <div className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu
          trigger={
            <button className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-black/20 transition-colors">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          }
          items={menuItems}
        />
      </div>

      <Link href={`/trips/${trip.id}`} className="block">
        {/* Gradient banner */}
        <div className={`h-24 bg-gradient-to-br ${gradient} relative flex items-center justify-center`}>
          <span className="text-4xl drop-shadow-sm select-none">{emoji}</span>
          <div className="absolute bottom-2 right-3">
            <StatusBadge status={trip.status} />
          </div>
        </div>

        {/* Card body */}
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-blue-700 transition-colors pr-6 leading-snug">
            {trip.name}
          </h3>

          {trip.description && (
            <p className="text-xs text-gray-400 mb-2 line-clamp-1">{trip.description}</p>
          )}

          <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{formatDate(trip.startDate)} — {formatDate(trip.endDate)}</span>
            </div>
            <span className="text-gray-400">{duration}</span>
          </div>

          <div className="mt-2">
            <CountdownChip startDate={trip.startDate} endDate={trip.endDate} />
          </div>
        </div>
      </Link>
    </div>
  );
}
