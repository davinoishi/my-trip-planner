import { FileText } from "lucide-react";

// Sprint 4 will build document upload and management here.
export default function DocumentsPage() {
  return (
    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100 border-dashed">
      <div className="bg-blue-50 w-14 h-14 rounded-2xl flex items-center justify-center mb-4">
        <FileText className="w-7 h-7 text-blue-400" />
      </div>
      <p className="text-gray-500 font-medium">Document storage coming in Sprint 4</p>
      <p className="text-gray-400 text-sm mt-1">Upload boarding passes, visas, insurance and more</p>
    </div>
  );
}
