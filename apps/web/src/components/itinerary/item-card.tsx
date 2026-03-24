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

/** Virtual item type used only in the timeline UI — one DB record may render as two cards. */
export type ExpandedItem = ApiItineraryItem & {
  /** When set, this card represents one leg of a multi-day flight or hotel stay. */
  _subtype?: "depart" | "arrive" | "checkin" | "checkout";
  /** Unique DnD id — avoids id collisions when two virtual cards share the same item.id. */
  _dndId?: string;
};

const SUBTYPE_LABEL: Record<string, string> = {
  depart: "Depart",
  arrive: "Arrive",
  checkin: "Check-in",
  checkout: "Check-out",
};

interface ItemCardProps {
  item: ExpandedItem;
  onEdit: (item: ExpandedItem) => void;
  onDelete: (item: ExpandedItem) => void;
}

function ItemSubtitle({ item }: { item: ExpandedItem }) {
  const d = item.details as Record<string, string> | null;
  if (!d) return null;

  switch (item.type) {
    case "flight": {
      const f = d as unknown as FlightDetails;
      const route =
        f.departureAirport && f.arrivalAirport
          ? `${f.departureAirport} → ${f.arrivalAirport}`
          : null;

      if (item._subtype === "arrive") {
        const parts = [route, f.arrivalTime ? `Arrives ${f.arrivalTime}` : null].filter(Boolean);
        return parts.length ? <span>{parts.join(" · ")}</span> : null;
      }
      // depart or no subtype
      const times =
        f.departureTime && f.arrivalTime
          ? `${f.departureTime} – ${f.arrivalTime}`
          : f.departureTime ?? item.startTime ?? null;
      const parts = [f.airline, f.flightNumber, route, times].filter(Boolean);
      return parts.length ? <span>{parts.join(" · ")}</span> : null;
    }
    case "hotel": {
      const h = d as unknown as HotelDetails;
      if (item._subtype === "checkout") {
        const parts = [
          h.hotelName,
          h.checkOutTime ? `Check-out ${h.checkOutTime}` : null,
        ].filter(Boolean);
        return parts.length ? <span>{parts.join(" · ")}</span> : null;
      }
      // checkin or no subtype
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
  const isVirtualSecondary = item._subtype === "arrive" || item._subtype === "checkout";

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item._dndId ?? item.id,
    disabled: isVirtualSecondary,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const subtypeLabel = item._subtype ? SUBTYPE_LABEL[item._subtype] : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm hover:border-gray-300 hover:shadow-md transition-all"
    >
      {/* Drag handle — hidden for virtual secondary cards */}
      {!isVirtualSecondary ? (
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab touch-none text-gray-300 opacity-0 group-hover:opacity-100 active:cursor-grabbing"
          tabIndex={-1}
          aria-label="Drag to reorder"
        >
          <GripVertical size={16} />
        </button>
      ) : (
        <div className="mt-0.5 w-4" />
      )}

      {/* Type icon */}
      <ItemTypeIcon type={item.type} withBg size={16} />

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium text-gray-900">{item.title}</p>
          {subtypeLabel && (
            <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 border border-indigo-100">
              {subtypeLabel}
            </span>
          )}
        </div>
        <p className="truncate text-xs text-gray-500 mt-0.5">
          <ItemSubtitle item={item} />
        </p>
        {item.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {item.tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-block px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-medium rounded-full border border-indigo-100"
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
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

      {/* Actions — always visible on mobile (no hover), fade in on desktop hover */}
      <div className="relative shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
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
