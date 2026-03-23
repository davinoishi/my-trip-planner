"use client";

import { use, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Users, UserPlus, Trash2, Clock, Edit2, Check, X, Plane } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  params: Promise<{ tripId: string }>;
}

const ROLE_LABELS = { viewer: "Read only", editor: "Full access" } as const;

function RoleBadge({ role }: { role: "viewer" | "editor" }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        role === "editor"
          ? "bg-blue-50 text-blue-700 border border-blue-100"
          : "bg-gray-100 text-gray-600 border border-gray-200"
      }`}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}

function PendingBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
      <Clock size={10} />
      Pending
    </span>
  );
}

export default function PeoplePage({ params }: Props) {
  const { tripId } = use(params);
  const utils = trpc.useUtils();

  const { data: access } = trpc.shares.myAccess.useQuery({ tripId });
  const { data: people = [], isLoading } = trpc.shares.tripList.useQuery({ tripId });

  const addMutation = trpc.shares.tripAdd.useMutation({
    onSuccess: () => utils.shares.tripList.invalidate({ tripId }),
  });
  const updateMutation = trpc.shares.tripUpdate.useMutation({
    onSuccess: () => utils.shares.tripList.invalidate({ tripId }),
  });
  const removeMutation = trpc.shares.tripRemove.useMutation({
    onSuccess: () => utils.shares.tripList.invalidate({ tripId }),
  });

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"viewer" | "editor">("viewer");
  const [isGoing, setIsGoing] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const isOwner = access?.isOwner ?? false;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    try {
      await addMutation.mutateAsync({ tripId, email: email.trim(), role, isGoingOnTrip: isGoing });
      setEmail("");
      setRole("viewer");
      setIsGoing(false);
    } catch (err: any) {
      setAddError(err?.message ?? "Failed to add person");
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">People</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage who has access to this trip and who is going.
          {!isOwner && " Only the trip owner can change permissions."}
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
        {isLoading ? (
          <div className="py-8 text-center text-sm text-gray-400">Loading…</div>
        ) : people.length === 0 ? (
          <div className="py-10 flex flex-col items-center gap-2 text-gray-400">
            <Users size={28} className="text-gray-300" />
            <p className="text-sm">No one else has access to this trip yet.</p>
          </div>
        ) : (
          people.map((person) => (
            <PersonRow
              key={person.id}
              person={person}
              isOwner={isOwner}
              onUpdate={(id, updates) =>
                updateMutation.mutate({ participantId: id, tripId, ...updates })
              }
              onRemove={(id) => removeMutation.mutate({ participantId: id, tripId })}
            />
          ))
        )}
      </div>

      {isOwner && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <UserPlus size={15} className="text-blue-500" />
            Add person
          </h3>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "viewer" | "editor")}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
              >
                <option value="viewer">Read only</option>
                <option value="editor">Full access</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isGoing}
                onChange={(e) => setIsGoing(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-300"
              />
              <Plane size={13} className="text-blue-400" />
              Going on this trip (counts toward their travel stats)
            </label>
            {addError && <p className="text-xs text-red-500">{addError}</p>}
            <Button type="submit" disabled={addMutation.isPending || !email.trim()} className="w-full">
              {addMutation.isPending ? "Adding…" : "Add person"}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}

interface PersonRowProps {
  person: {
    id: string;
    email: string;
    role: string;
    isGoingOnTrip: number;
    isPending: boolean;
    source: "trip" | "account";
  };
  isOwner: boolean;
  onUpdate: (id: string, updates: { role?: "viewer" | "editor"; isGoingOnTrip?: boolean }) => void;
  onRemove: (id: string) => void;
}

function PersonRow({ person, isOwner, onUpdate, onRemove }: PersonRowProps) {
  const [editing, setEditing] = useState(false);
  const [draftRole, setDraftRole] = useState<"viewer" | "editor">(person.role as "viewer" | "editor");

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-500 shrink-0">
        {person.email[0]?.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{person.email}</p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {person.isPending && <PendingBadge />}
          {person.source === "account" && (
            <span className="text-[10px] text-gray-400">via account share</span>
          )}
          {person.isGoingOnTrip === 1 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-blue-600">
              <Plane size={9} /> Going on trip
            </span>
          )}
        </div>
      </div>

      {editing ? (
        <div className="flex items-center gap-1">
          <select
            value={draftRole}
            onChange={(e) => setDraftRole(e.target.value as "viewer" | "editor")}
            className="rounded border border-gray-200 px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
            autoFocus
          >
            <option value="viewer">Read only</option>
            <option value="editor">Full access</option>
          </select>
          <button onClick={() => { onUpdate(person.id, { role: draftRole }); setEditing(false); }} className="p-1 text-green-600 hover:text-green-700"><Check size={14} /></button>
          <button onClick={() => setEditing(false)} className="p-1 text-gray-400 hover:text-gray-600"><X size={14} /></button>
        </div>
      ) : (
        <RoleBadge role={person.role as "viewer" | "editor"} />
      )}

      {isOwner && !editing && (
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => onUpdate(person.id, { isGoingOnTrip: person.isGoingOnTrip !== 1 })}
            title={person.isGoingOnTrip === 1 ? "Remove from trip roster" : "Mark as going"}
            className={`p-1.5 rounded transition-colors ${person.isGoingOnTrip === 1 ? "text-blue-500 hover:text-blue-700" : "text-gray-300 hover:text-blue-400"}`}
          >
            <Plane size={13} />
          </button>
          {person.source === "trip" && (
            <>
              <button onClick={() => setEditing(true)} className="p-1.5 rounded text-gray-400 hover:text-gray-600 transition-colors" title="Change permission"><Edit2 size={13} /></button>
              <button onClick={() => onRemove(person.id)} className="p-1.5 rounded text-gray-300 hover:text-red-500 transition-colors" title="Remove"><Trash2 size={13} /></button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
