/**
 * Timezone-aware date utilities.
 * All datetimes are stored in UTC; timezone is stored separately per booking.
 */

export function formatDate(date: Date | string, timezone = "UTC"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

export function formatDateTime(date: Date | string, timezone = "UTC"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/**
 * Returns the number of days between two YYYY-MM-DD strings.
 */
export function daysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Given a trip start date and a day index (0-based), return the YYYY-MM-DD for that day.
 */
export function tripDayDate(startDate: string, dayIndex: number): string {
  const date = new Date(startDate);
  date.setDate(date.getDate() + dayIndex);
  return date.toISOString().split("T")[0]!;
}

