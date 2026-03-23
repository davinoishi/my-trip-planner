"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { format, addDays } from "date-fns";
import { ItemCard, type ApiItineraryItem } from "./item-card";
import { Button } from "@/components/ui/button";

// WMO weather code → emoji
function weatherEmoji(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 3) return "⛅";
  if (code <= 48) return "🌫️";
  if (code <= 57) return "🌦️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "❄️";
  if (code <= 82) return "🌧️";
  if (code <= 86) return "🌨️";
  return "⛈️";
}

interface DayForecast {
  weathercode: number;
  maxTempC: number;
  minTempC: number;
  maxTempF: number;
  minTempF: number;
}

interface DaySectionProps {
  dayIndex: number;
  tripStartDate: string; // "YYYY-MM-DD"
  items: ApiItineraryItem[];
  onAddItem: (dayIndex: number) => void;
  onEditItem: (item: ApiItineraryItem) => void;
  onDeleteItem: (item: ApiItineraryItem) => void;
  forecast?: DayForecast | null;
}

export function DaySection({
  dayIndex,
  tripStartDate,
  items,
  onAddItem,
  onEditItem,
  onDeleteItem,
  forecast,
}: DaySectionProps) {
  const dayDate = addDays(new Date(tripStartDate + "T00:00:00"), dayIndex);
  const dayLabel = format(dayDate, "EEEE, MMMM d");
  const itemIds = items.map((i) => i.id);

  const { setNodeRef } = useDroppable({ id: `day-${dayIndex}` });

  return (
    <div className="space-y-2">
      {/* Day header */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
          {dayIndex + 1}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">{dayLabel}</p>
        </div>
        {forecast && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span>{weatherEmoji(forecast.weathercode)}</span>
            <span className="font-medium text-gray-700">{forecast.maxTempC}°</span>
            <span>/</span>
            <span>{forecast.minTempC}°C</span>
            <span className="text-gray-400">({forecast.maxTempF}°/{forecast.minTempF}°F)</span>
          </div>
        )}
        <div className="ml-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAddItem(dayIndex)}
            className="gap-1 text-xs text-gray-500 hover:text-indigo-600"
          >
            <Plus size={13} />
            Add
          </Button>
        </div>
      </div>

      {/* Items */}
      <div ref={setNodeRef} className="space-y-2 pl-11 min-h-[2px]">
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onEdit={onEditItem}
              onDelete={onDeleteItem}
            />
          ))}
        </SortableContext>

        {items.length === 0 && (
          <button
            onClick={() => onAddItem(dayIndex)}
            className="w-full rounded-lg border-2 border-dashed border-gray-200 py-4 text-sm text-gray-400 transition hover:border-indigo-300 hover:text-indigo-500"
          >
            + Add an item to Day {dayIndex + 1}
          </button>
        )}
      </div>
    </div>
  );
}
