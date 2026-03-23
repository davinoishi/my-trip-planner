"use client";

import { use, useEffect, useRef, useState } from "react";
import {
  RefreshCw,
  Plus,
  Trash2,
  CheckSquare,
  ShoppingBag,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { AIRPORT_COORDS } from "@/lib/airports";

type PackingItem = RouterOutputs["packingList"]["list"][number];

// ── Helpers ────────────────────────────────────────────────────────────────────

const CATEGORY_ORDER = [
  "Documents & IDs",
  "Money & Banking",
  "Clothing",
  "Footwear",
  "Toiletries",
  "Health & Medication",
  "Electronics",
  "Travel Accessories",
];

const CATEGORY_EMOJI: Record<string, string> = {
  "Documents & IDs": "🪪",
  "Money & Banking": "💳",
  "Clothing": "👕",
  "Footwear": "👟",
  "Toiletries": "🧴",
  "Health & Medication": "💊",
  "Electronics": "🔌",
  "Travel Accessories": "🎒",
};

function groupByCategory(items: PackingItem[]): Map<string, PackingItem[]> {
  const map = new Map<string, PackingItem[]>();
  // Ensure known categories appear in order
  for (const cat of CATEGORY_ORDER) map.set(cat, []);
  for (const item of items) {
    if (!map.has(item.category)) map.set(item.category, []);
    map.get(item.category)!.push(item);
  }
  // Remove empty known categories
  for (const [cat, list] of map) {
    if (list.length === 0) map.delete(cat);
  }
  return map;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function PackingItemRow({
  item,
  onToggle,
  onDelete,
}: {
  item: PackingItem;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 py-2 group">
      <button
        onClick={onToggle}
        className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
          item.isChecked
            ? "bg-green-500 border-green-500 text-white"
            : "border-gray-300 hover:border-green-400"
        }`}
      >
        {item.isChecked ? (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 12 12">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </button>
      <span
        className={`flex-1 text-sm transition-colors ${
          item.isChecked ? "line-through text-gray-400" : "text-gray-800"
        }`}
      >
        {item.name}
        {item.isCustom ? (
          <span className="ml-1.5 text-xs text-blue-400">custom</span>
        ) : null}
      </span>
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all rounded"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

function CategorySection({
  category,
  items,
  onToggle,
  onDelete,
  onAdd,
}: {
  category: string;
  items: PackingItem[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: (category: string, name: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const checked = items.filter((i) => i.isChecked).length;
  const total = items.length;

  function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    onAdd(category, name);
    setNewName("");
    setAdding(false);
  }

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Category header */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-base">{CATEGORY_EMOJI[category] ?? "📦"}</span>
          <span className="text-sm font-semibold text-gray-900">{category}</span>
          <span className="text-xs text-gray-400">
            {checked}/{total}
          </span>
          {checked === total && total > 0 && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
              Done ✓
            </span>
          )}
        </div>
        {collapsed ? (
          <ChevronRight size={14} className="text-gray-400" />
        ) : (
          <ChevronDown size={14} className="text-gray-400" />
        )}
      </button>

      {!collapsed && (
        <div className="px-4 pb-3 divide-y divide-gray-50">
          {items.map((item) => (
            <PackingItemRow
              key={item.id}
              item={item}
              onToggle={() => onToggle(item.id)}
              onDelete={() => onDelete(item.id)}
            />
          ))}

          {/* Add item */}
          {adding ? (
            <form onSubmit={handleAddSubmit} className="flex gap-2 pt-2">
              <input
                ref={inputRef}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Item name…"
                className="flex-1 text-sm rounded-lg border border-gray-200 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
              />
              <Button type="submit" size="sm" variant="primary">Add</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </form>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-400 hover:text-blue-600 transition-colors py-1"
            >
              <Plus size={12} />
              Add item
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

interface PackingPageProps {
  params: Promise<{ tripId: string }>;
}

export default function PackingPage({ params }: PackingPageProps) {
  const { tripId } = use(params);
  const utils = trpc.useUtils();

  // Get trip items to determine primary destination
  const { data: tripItems = [] } = trpc.itineraryItems.list.useQuery({ tripId });

  // Compute primary destination lat for rule-based generation
  const destinationLat = (() => {
    const flights = tripItems.filter((i) => i.type === "flight");
    for (const item of flights) {
      const d = (item.details ?? {}) as Record<string, unknown>;
      type Leg = { arrivalAirport?: string };
      const legs = (d.legs ?? d.segments ?? d.flights) as Leg[] | undefined;
      // Use last arrival airport of the trip as primary destination
      const lastLeg = legs?.[legs.length - 1];
      const iata = lastLeg?.arrivalAirport ?? (d.arrivalAirport as string | undefined);
      if (iata) {
        const coords = AIRPORT_COORDS[iata]; // [lon, lat]
        if (coords) return coords[1]; // latitude
      }
    }
    return undefined;
  })();

  const generateInput = { tripId, destinationLat };

  const { data: items = [], isLoading } = trpc.packingList.list.useQuery({ tripId });

  const generate = trpc.packingList.generate.useMutation({
    onSuccess: () => utils.packingList.list.invalidate({ tripId }),
  });
  const regenerate = trpc.packingList.regenerate.useMutation({
    onSuccess: () => utils.packingList.list.invalidate({ tripId }),
  });
  const toggle = trpc.packingList.toggleItem.useMutation({
    onMutate: async ({ id }) => {
      // Optimistic update
      await utils.packingList.list.cancel({ tripId });
      const prev = utils.packingList.list.getData({ tripId });
      utils.packingList.list.setData({ tripId }, (old) =>
        old?.map((item) =>
          item.id === id ? { ...item, isChecked: item.isChecked ? 0 : 1 } : item
        )
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) utils.packingList.list.setData({ tripId }, ctx.prev);
    },
  });
  const deleteItem = trpc.packingList.deleteItem.useMutation({
    onSuccess: () => utils.packingList.list.invalidate({ tripId }),
  });
  const addItem = trpc.packingList.addItem.useMutation({
    onSuccess: () => utils.packingList.list.invalidate({ tripId }),
  });
  const clearChecked = trpc.packingList.clearChecked.useMutation({
    onSuccess: () => utils.packingList.list.invalidate({ tripId }),
  });

  // Auto-generate on first visit if empty
  useEffect(() => {
    if (!isLoading && items.length === 0) {
      generate.mutate(generateInput);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  const grouped = groupByCategory(items);
  const totalItems = items.length;
  const checkedItems = items.filter((i) => i.isChecked).length;
  const pct = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;

  if (isLoading || generate.isPending) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-40 bg-gray-100 rounded animate-pulse" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-sm text-gray-500">
              {checkedItems}/{totalItems} packed
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          {checkedItems > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => clearChecked.mutate({ tripId })}
              disabled={clearChecked.isPending}
              className="gap-1.5 text-xs"
            >
              <CheckSquare size={13} />
              Clear checks
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => regenerate.mutate(generateInput)}
            disabled={regenerate.isPending}
            className="gap-1.5 text-xs"
          >
            <RefreshCw size={13} className={regenerate.isPending ? "animate-spin" : ""} />
            Regenerate
          </Button>
        </div>
      </div>

      {/* Category sections */}
      {items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No packing list yet.</p>
          <Button
            variant="primary"
            size="sm"
            className="mt-4"
            onClick={() => generate.mutate(generateInput)}
          >
            Generate packing list
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {Array.from(grouped.entries()).map(([category, catItems]) => (
            <CategorySection
              key={category}
              category={category}
              items={catItems}
              onToggle={(id) => toggle.mutate({ id })}
              onDelete={(id) => deleteItem.mutate({ id })}
              onAdd={(cat, name) => addItem.mutate({ tripId, category: cat, name })}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center pt-2">
        Items are generated based on your itinerary, destination, and trip duration.
        Add or remove items to customize your list.
      </p>
    </div>
  );
}
