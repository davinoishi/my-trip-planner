import { Map } from "lucide-react";

// Sprint 6 will build the interactive map here.
export default function MapPage() {
  return (
    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100 border-dashed">
      <div className="bg-blue-50 w-14 h-14 rounded-2xl flex items-center justify-center mb-4">
        <Map className="w-7 h-7 text-blue-400" />
      </div>
      <p className="text-gray-500 font-medium">Map view coming in Sprint 6</p>
      <p className="text-gray-400 text-sm mt-1">Interactive map with pins, routes and more</p>
    </div>
  );
}
