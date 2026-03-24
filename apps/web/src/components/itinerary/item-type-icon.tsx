"use client";

import {
  Plane,
  Hotel,
  Car,
  Train,
  Ticket,
  ArrowRightLeft,
  StickyNote,
} from "lucide-react";
import type { BookingType } from "@trip/shared";

const icons: Record<BookingType, React.ElementType> = {
  flight: Plane,
  hotel: Hotel,
  car_rental: Car,
  train: Train,
  activity: Ticket,
  transfer: ArrowRightLeft,
  note: StickyNote,
};

const colors: Record<BookingType, string> = {
  flight: "text-blue-500",
  hotel: "text-purple-500",
  car_rental: "text-orange-500",
  train: "text-green-500",
  activity: "text-pink-500",
  transfer: "text-cyan-500",
  note: "text-yellow-500",
};

const bgColors: Record<BookingType, string> = {
  flight: "bg-blue-50",
  hotel: "bg-purple-50",
  car_rental: "bg-orange-50",
  train: "bg-green-50",
  activity: "bg-pink-50",
  transfer: "bg-cyan-50",
  note: "bg-yellow-50",
};

interface ItemTypeIconProps {
  type: BookingType;
  size?: number;
  withBg?: boolean;
}

export function ItemTypeIcon({ type, size = 16, withBg = false }: ItemTypeIconProps) {
  const Icon = icons[type];
  if (!withBg) return <Icon size={size} className={colors[type]} />;
  return (
    <span className={`inline-flex items-center justify-center rounded-lg p-2 ${bgColors[type]}`}>
      <Icon size={size} className={colors[type]} />
    </span>
  );
}

export const typeLabel: Record<BookingType, string> = {
  flight: "Flight",
  hotel: "Hotel",
  car_rental: "Car Rental",
  train: "Train",
  activity: "Activity",
  transfer: "Transfer",
  note: "Note",
};

