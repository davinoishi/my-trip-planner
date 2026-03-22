import { List } from "lucide-react";

// Sprint 3 will build the full itinerary timeline here.
export default function ItineraryPage() {
  return (
    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100 border-dashed">
      <div className="bg-blue-50 w-14 h-14 rounded-2xl flex items-center justify-center mb-4">
        <List className="w-7 h-7 text-blue-400" />
      </div>
      <p className="text-gray-500 font-medium">Itinerary coming in Sprint 3</p>
      <p className="text-gray-400 text-sm mt-1">Add flights, hotels, activities and more</p>
    </div>
  );
}
