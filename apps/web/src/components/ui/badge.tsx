import { cn } from "@/lib/utils";
import type { TripStatus } from "@trip/shared";

const statusStyles: Record<TripStatus, string> = {
  planning:  "bg-yellow-50 text-yellow-700 border-yellow-100",
  confirmed: "bg-green-50 text-green-700 border-green-100",
  completed: "bg-gray-100 text-gray-600 border-gray-200",
  archived:  "bg-gray-100 text-gray-500 border-gray-200",
  canceled:  "bg-red-50 text-red-600 border-red-100",
};

interface StatusBadgeProps {
  status: TripStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize",
        statusStyles[status],
        className
      )}
    >
      {status}
    </span>
  );
}

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "blue" | "green" | "yellow" | "red";
  className?: string;
}

const badgeVariants = {
  default: "bg-gray-100 text-gray-700",
  blue:    "bg-blue-50 text-blue-700",
  green:   "bg-green-50 text-green-700",
  yellow:  "bg-yellow-50 text-yellow-700",
  red:     "bg-red-50 text-red-600",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium", badgeVariants[variant], className)}>
      {children}
    </span>
  );
}

