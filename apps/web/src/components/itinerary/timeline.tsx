"use client";

import { useState, useMemo, useEffect } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { differenceInCalendarDays, addDays, parseISO } from "date-fns";
import type { BookingType } from "@trip/shared";
import { type ApiItineraryItem } from "./item-card";
import { DaySection } from "./day-section";
import { ItemCard } from "./item-card";
import { ItemForm } from "./item-form";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface TimelineProps {
  tripId: string;
  startDate: string; // "YYYY-MM-DD"
  endDate: string;   // "YYYY-MM-DD"
}

interface DayForecast {
  date: string;
  weathercode: number;
  maxTempC: number;
  minTempC: number;
  maxTempF: number;
  minTempF: number;
}

export function Timeline({ tripId, startDate, endDate }: TimelineProps) {
  const utils = trpc.useUtils();
  const { data: items = [], isLoading } = trpc.itineraryItems.list.useQuery({ tripId });

  // ── Forecast (only for trips within 10 days) ──────────────────────────────
  const [forecastByDate, setForecastByDate] = useState<Map<string, DayForecast>>(new Map());

  useEffect(() => {
    const today = new Date();
    const tripStartDate = parseISO(startDate);
    const tripEndDate = parseISO(endDate);
    const tenDaysFromNow = addDays(today, 10);

    const isUpcoming = tripStartDate <= tenDaysFromNow;
    const isOngoing = today >= tripStartDate && today <= tripEndDate;

    if (!isUpcoming && !isOngoing) return;

    fetch(`/api/trips/${tripId}/forecast`)
      .then((r) => r.ok ? r.json() : { forecasts: [] })
      .then((data: { forecasts: DayForecast[] }) => {
        const map = new Map<string, DayForecast>();
        for (const f of data.forecasts) map.set(f.date, f);
        setForecastByDate(map);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  const createItem = trpc.itineraryItems.create.useMutation({
    onSuccess: () => utils.itineraryItems.list.invalidate({ tripId }),
  });
  const updateItem = trpc.itineraryItems.update.useMutation({
    onSuccess: () => utils.itineraryItems.list.invalidate({ tripId }),
  });
  const setItemTags = trpc.tags.setItemTags.useMutation({
    onSuccess: () => utils.itineraryItems.list.invalidate({ tripId }),
  });
  const deleteItem = trpc.itineraryItems.delete.useMutation({
    onSuccess: () => utils.itineraryItems.list.invalidate({ tripId }),
  });
  const reorderItems = trpc.itineraryItems.reorder.useMutation({
    onSuccess: () => utils.itineraryItems.list.invalidate({ tripId }),
  });

  // ── Modal state ───────────────────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [formDayIndex, setFormDayIndex] = useState(0);
  const [editingItem, setEditingItem] = useState<ApiItineraryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiItineraryItem | null>(null);
  const [activeItem, setActiveItem] = useState<ApiItineraryItem | null>(null);

  // ── Trip duration ─────────────────────────────────────────────────────────
  const numDays = useMemo(() => {
    const diff = differenceInCalendarDays(parseISO(endDate), parseISO(startDate));
    return Math.max(diff + 1, 1);
  }, [startDate, endDate]);

  // ── Group items by day ────────────────────────────────────────────────────
  const itemsByDay = useMemo(() => {
    const map = new Map<number, ApiItineraryItem[]>();
    for (let i = 0; i < numDays; i++) map.set(i, []);
    for (const item of items) {
      const day = Math.min(item.dayIndex, numDays - 1);
      map.get(day)?.push(item);
    }
    // Sort within each day
    for (const [, dayItems] of map) {
      dayItems.sort((a, b) => a.sortOrder - b.sortOrder || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    return map;
  }, [items, numDays]);

  // ── Drag and drop ─────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function handleDragStart(event: DragStartEvent) {
    const item = items.find((i) => i.id === event.active.id);
    setActiveItem(item ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveItem(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Determine target day from the over id (could be a day droppable or another item)
    const overId = String(over.id);
    const overDayMatch = overId.match(/^day-(\d+)$/);
    const targetDayIndex = overDayMatch
      ? parseInt(overDayMatch[1]!)
      : items.find((i) => i.id === overId)?.dayIndex;

    if (targetDayIndex === undefined) return;

    const activeItemData = items.find((i) => i.id === active.id);
    if (!activeItemData) return;

    const sourceDayIndex = activeItemData.dayIndex;
    const sourceDayItems = [...(itemsByDay.get(sourceDayIndex) ?? [])];
    const targetDayItems =
      sourceDayIndex === targetDayIndex
        ? sourceDayItems
        : [...(itemsByDay.get(targetDayIndex) ?? [])];

    let reordered: ApiItineraryItem[];

    if (sourceDayIndex === targetDayIndex) {
      const oldIdx = sourceDayItems.findIndex((i) => i.id === active.id);
      const newIdx = sourceDayItems.findIndex((i) => i.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return;
      reordered = arrayMove(sourceDayItems, oldIdx, newIdx);
    } else {
      // Moving between days
      const fromIdx = sourceDayItems.findIndex((i) => i.id === active.id);
      sourceDayItems.splice(fromIdx, 1);
      targetDayItems.push(activeItemData);
      reordered = targetDayItems;
    }

    // Build bulk reorder payload
    const payload: { id: string; dayIndex: number; sortOrder: number }[] = [];

    if (sourceDayIndex !== targetDayIndex) {
      sourceDayItems.forEach((item, i) =>
        payload.push({ id: item.id, dayIndex: sourceDayIndex, sortOrder: i })
      );
    }
    reordered.forEach((item, i) =>
      payload.push({ id: item.id, dayIndex: targetDayIndex, sortOrder: i })
    );

    reorderItems.mutate({ tripId, items: payload });
  }

  // ── Form handlers ─────────────────────────────────────────────────────────
  function openAdd(dayIndex: number) {
    setEditingItem(null);
    setFormDayIndex(dayIndex);
    setFormOpen(true);
  }

  function openEdit(item: ApiItineraryItem) {
    setEditingItem(item);
    setFormDayIndex(item.dayIndex);
    setFormOpen(true);
  }

  async function handleFormSubmit(data: {
    type: BookingType;
    title: string;
    notes?: string;
    startTime?: string;
    endTime?: string;
    details: Record<string, unknown>;
    tagIds: string[];
  }) {
    let itemId: string;
    if (editingItem) {
      await updateItem.mutateAsync({
        id: editingItem.id,
        data: {
          type: data.type,
          title: data.title,
          notes: data.notes,
          startTime: data.startTime,
          endTime: data.endTime,
          details: data.details,
          dayIndex: formDayIndex,
          version: editingItem.version,
        },
      });
      itemId = editingItem.id;
    } else {
      const created = await createItem.mutateAsync({
        tripId,
        dayIndex: formDayIndex,
        type: data.type,
        title: data.title,
        notes: data.notes,
        startTime: data.startTime,
        endTime: data.endTime,
        details: data.details,
      });
      itemId = created.id;
    }
    if (data.tagIds.length > 0 || editingItem) {
      await setItemTags.mutateAsync({ itemId, tagIds: data.tagIds });
    }
    setFormOpen(false);
    setEditingItem(null);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    await deleteItem.mutateAsync({ id: deleteTarget.id });
    setDeleteTarget(null);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-gray-400">
        Loading itinerary…
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-8">
          {Array.from({ length: numDays }, (_, i) => {
            const dayDate = addDays(parseISO(startDate), i);
            const dateStr = dayDate.toISOString().slice(0, 10);
            return (
              <DaySection
                key={i}
                dayIndex={i}
                tripStartDate={startDate}
                items={itemsByDay.get(i) ?? []}
                onAddItem={openAdd}
                onEditItem={openEdit}
                onDeleteItem={setDeleteTarget}
                forecast={forecastByDate.get(dateStr) ?? null}
              />
            );
          })}
        </div>

        {/* Drag overlay — shows a ghost of the dragged card */}
        <DragOverlay>
          {activeItem && (
            <div className="rotate-1 opacity-90 shadow-lg">
              <ItemCard
                item={activeItem}
                onEdit={() => {}}
                onDelete={() => {}}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Add Item FAB on mobile */}
      <div className="fixed bottom-6 right-6 md:hidden">
        <Button onClick={() => openAdd(0)} className="rounded-full shadow-lg gap-1">
          <Plus size={16} />
          Add Item
        </Button>
      </div>

      {/* Add / Edit item form */}
      <ItemForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingItem(null); }}
        onSubmit={handleFormSubmit}
        defaultDayIndex={formDayIndex}
        tripDurationDays={numDays}
        editingItem={editingItem}
        initialTagIds={editingItem?.tags?.map((t) => t.id) ?? []}
        isLoading={createItem.isPending || updateItem.isPending || setItemTags.isPending}
      />

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900">Delete Item?</h3>
            <p className="mt-1 text-sm text-gray-500">
              <strong>{deleteTarget.title}</strong> will be permanently removed from your itinerary.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteConfirm}
                disabled={deleteItem.isPending}
              >
                {deleteItem.isPending ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
