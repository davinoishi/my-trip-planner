import { TripDetailHeader } from "@/components/trips/trip-detail-header";
import { TripTabs } from "@/components/trips/trip-tabs";

interface TripLayoutProps {
  children: React.ReactNode;
  params: Promise<{ tripId: string }>;
}

export default async function TripLayout({ children, params }: TripLayoutProps) {
  const { tripId } = await params;

  return (
    <div className="max-w-6xl mx-auto space-y-0">
      <TripDetailHeader tripId={tripId} />
      <TripTabs tripId={tripId} />
      <div className="pt-4 md:pt-6">{children}</div>
    </div>
  );
}
