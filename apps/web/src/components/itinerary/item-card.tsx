"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2, MoreHorizontal } from "lucide-react";
import type { RouterOutputs } from "@/lib/trpc";
import type {
  FlightDetails,
  HotelDetails,
  CarRentalDetails,
  TrainDetails,
  ActivityDetails,
  TransferDetails,
} from "@trip/shared";
import { ItemTypeIcon, typeLabel } from "./item-type-icon";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export type ApiItineraryItem = RouterOutputs["itineraryItems"]["list"][number];

interface ItemCardProps {
  item: ApiItineraryItem;
  onEdit: (item: ApiItineraryItem) => void;
  onDelete: (item: ApiItineraryItem) => void;
}

function ItemSubtitle({ item }: { item: ApiItineraryItem }) {
  const d = item.details as Record<string, string> | null;
  if (!d) return null;

  switch (item.type) {
    case "flight": {
      const f = d as unknown as FlightDetails;
      const route =
        f.departureAirport && f.arrivalAirport
          ? `${f.departureAirport} → ${f.arrivalAirport}`
          : null;
      const times =
        f.departureTime && f.arrivalTime
          ? `${f.departureTime} – ${f.arrivalTime}`
          : item.startTime ?? null;
      const parts = [f.airline, f.flightNumber, route, times].filter(Boolean);
      return parts.length ? <span>{parts.join(" · ")}</span> : null;
    }
    case "hotel": {
      const h = d as unknown as HotelDetails;
      const parts = [
        h.hotelName,
        h.checkInTime ? `Check-in ${h.checkInTime}` : null,
        h.confirmationNumber ? `Conf: ${h.confirmationNumber}` : null,
      ].filter(Boolean);
      return parts.length ? <span>{parts.join(" · ")}</span> : null;
    }
    case "car_rental": {
      const c = d as unknown as CarRentalDetails;
      const parts = [
        c.company,
        c.carType,
        c.pickupLocation,
        c.confirmationNumber ? `Conf: ${c.confirmationNumber}` : null,
      ].filter(Boolean);
      return parts.length ? <span>{parts.join(" · ")}</span> : null;
    }
    case "train": {
      const t = d as unknown as TrainDetails;
      const route =
        t.departureStation && t.arrivalStation
          ? `${t.departureStation} → ${t.arrivalStation}`
          : null;
      const parts = [t.carrier, t.trainNumber, route, t.departureTime].filter(Boolean);
      return parts.length ? <span>{parts.join(" · ")}</span> : null;
    }
    case "activity": {
      const a = d as unknown as ActivityDetails;
      const time =
        a.startTime && a.endTime
          ? `${a.startTime} – ${a.endTime}`
          : a.startTime ?? item.startTime ?? null;
      const parts = [a.venue, a.address, time].filter(Boolean);
      return parts.length ? <span>{parts.join(" · ")}</span> : null;
    }
    case "transfer": {
      const t = d as unknown as TransferDetails;
      const route =
        t.pickupLocation && t.dropoffLocation
          ? `${t.pickupLocation} → ${t.dropoffLocation}`
          : null;
      const parts = [t.provider, route, t.pickupTime].filter(Boolean);
      return parts.length ? <span>{parts.join(" · ")}</span> : null;
    }
    case "note":
      return item.notes ? (
        <span className="line-clamp-1">{item.notes}</span>
      ) : null;
    default:
      return null;
  }
}

export function ItemCard({ item, onEdit, onDelete }: ItemCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm hover:border-gray-300 hover:shadow-md transition-all"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="mt-0.5 cursor-grab touch-none text-gray-300 opacity-0 group-hover:opacity-100 active:cursor-grabbing"
        tabIndex={-1}
        aria-label="Drag to reorder"
      >
        <GripVertical size={16} />
      </button>

      {/* Type icon */}
      <ItemTypeIcon type={item.type} withBg size={16} />

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">{item.title}</p>
        <p className="truncate text-xs text-gray-500 mt-0.5">
          <ItemSubtitle item={item} />
        </p>
        {item.isDraft === 1 && (
          <span className="mt-1 inline-block rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
            Needs review
          </span>
        )}
      </div>

      {/* Time badge */}
      {item.startTime && (
        <span className="shrink-0 text-xs text-gray-400 tabular-nums">
          {item.startTime}
        </span>
      )}

      {/* Actions */}
      <div className="relative shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu
          trigger={
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              <MoreHorizontal size={14} />
            </Button>
          }
          items={[
            {
              label: "Edit",
              icon: <Pencil size={14} />,
              onClick: () => onEdit(item),
            },
            {
              label: "Delete",
              icon: <Trash2 size={14} />,
              onClick: () => onDelete(item),
              variant: "danger",
            },
          ]}
        />
      </div>
    </div>
  );
}
