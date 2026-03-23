"use client";

import { useState } from "react";
import { Calendar, Copy, Check, RefreshCw, Users, UserPlus, Trash2, Edit2, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const [copied, setCopied] = useState(false);

  const { data, isLoading, refetch } = trpc.users.getCalendarToken.useQuery();
  const reset = trpc.users.resetCalendarToken.useMutation({
    onSuccess: () => refetch(),
  });

  const calendarUrl =
    typeof window !== "undefined" && data?.token
      ? `${window.location.origin}/api/calendar/${data.token}`
      : "";

  async function handleCopy() {
    if (!calendarUrl) return;
    await navigator.clipboard.writeText(calendarUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleReset() {
    if (
      confirm(
        "Reset your calendar URL?\n\nAny apps currently subscribed to your calendar will stop receiving updates until you add the new URL."
      )
    ) {
      reset.mutate();
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your account preferences</p>
      </div>

      {/* Account-level sharing */}
      <AccountSharing />

      {/* Calendar subscription card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-start gap-3">
          <Calendar className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h2 className="font-semibold text-gray-900">Calendar Subscription</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Subscribe to your trips in Google Calendar, Apple Calendar, or any app that supports iCal feeds.
            </p>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* How to use */}
          <div className="bg-blue-50 rounded-xl px-4 py-3 text-sm text-blue-800 space-y-1">
            <p className="font-medium">How to subscribe:</p>
            <ol className="list-decimal list-inside space-y-0.5 text-blue-700">
              <li>Copy the URL below</li>
              <li>In Google Calendar: Other calendars → "From URL" → paste</li>
              <li>In Apple Calendar: File → New Calendar Subscription → paste</li>
            </ol>
          </div>

          {/* URL + copy button */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">
              Your private calendar URL
            </label>
            {isLoading ? (
              <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />
            ) : (
              <div className="flex gap-2">
                <input
                  readOnly
                  value={calendarUrl}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="flex-1 min-w-0 rounded-xl border border-gray-200 px-3 py-2 text-xs font-mono text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="flex-shrink-0 gap-1.5"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-green-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
            )}
          </div>

          {/* Reset section */}
          <div className="pt-4 border-t border-gray-100 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-800">Reset calendar URL</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Generates a new private URL. Any existing calendar subscriptions will stop working and need to be re-added with the new URL.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={reset.isPending}
              className="flex-shrink-0 gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${reset.isPending ? "animate-spin" : ""}`} />
              Reset URL
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Account-level sharing ──────────────────────────────────────────────────────

function AccountSharing() {
  const utils = trpc.useUtils();
  const { data: shares = [], isLoading } = trpc.shares.accountList.useQuery();

  const addMutation = trpc.shares.accountAdd.useMutation({
    onSuccess: () => utils.shares.accountList.invalidate(),
  });
  const updateMutation = trpc.shares.accountUpdate.useMutation({
    onSuccess: () => utils.shares.accountList.invalidate(),
  });
  const removeMutation = trpc.shares.accountRemove.useMutation({
    onSuccess: () => utils.shares.accountList.invalidate(),
  });

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"viewer" | "editor">("viewer");
  const [addError, setAddError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<"viewer" | "editor">("viewer");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    try {
      await addMutation.mutateAsync({ email: email.trim(), role });
      setEmail("");
      setRole("viewer");
    } catch (err: any) {
      setAddError(err?.message ?? "Failed to add");
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100 flex items-start gap-3">
        <Users className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div>
          <h2 className="font-semibold text-gray-900">Account Sharing</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Share all your trips with family members or travel companions. They will see every trip
            you create, now and in the future.
          </p>
        </div>
      </div>

      <div className="divide-y divide-gray-50">
        {isLoading ? (
          <div className="px-6 py-4 text-sm text-gray-400">Loading…</div>
        ) : shares.length === 0 ? (
          <div className="px-6 py-4 text-sm text-gray-400">
            No one has access to your account yet.
          </div>
        ) : (
          shares.map((share: any) => (
            <div key={share.id} className="flex items-center gap-3 px-6 py-3">
              <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-500 shrink-0">
                {share.sharedWithEmail[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{share.sharedWithEmail}</p>
                {!share.sharedWithUserId && (
                  <span className="text-[10px] text-amber-600">Pending — not signed up yet</span>
                )}
              </div>
              {editingId === share.id ? (
                <div className="flex items-center gap-1">
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as "viewer" | "editor")}
                    className="rounded border border-gray-200 px-2 py-1 text-xs bg-white"
                    autoFocus
                  >
                    <option value="viewer">Read only</option>
                    <option value="editor">Full access</option>
                  </select>
                  <button
                    onClick={() => { updateMutation.mutate({ shareId: share.id, role: editRole }); setEditingId(null); }}
                    className="p-1 text-green-600 hover:text-green-700"
                  >
                    <Check size={14} />
                  </button>
                  <button onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:text-gray-600">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  share.role === "editor" ? "bg-blue-50 text-blue-700 border border-blue-100" : "bg-gray-100 text-gray-600 border border-gray-200"
                }`}>
                  {share.role === "editor" ? "Full access" : "Read only"}
                </span>
              )}
              {editingId !== share.id && (
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => { setEditingId(share.id); setEditRole(share.role); }}
                    className="p-1.5 rounded text-gray-400 hover:text-gray-600"
                    title="Change permission"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => removeMutation.mutate({ shareId: share.id })}
                    className="p-1.5 rounded text-gray-300 hover:text-red-500"
                    title="Revoke access"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="px-6 py-5 border-t border-gray-100">
        <form onSubmit={handleAdd} className="flex gap-2">
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
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="viewer">Read only</option>
            <option value="editor">Full access</option>
          </select>
          <Button type="submit" disabled={addMutation.isPending || !email.trim()} size="sm" className="gap-1.5">
            <UserPlus size={14} />
            {addMutation.isPending ? "Adding…" : "Add"}
          </Button>
        </form>
        {addError && <p className="mt-2 text-xs text-red-500">{addError}</p>}
      </div>
    </div>
  );
}
