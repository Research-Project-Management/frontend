import { X } from "lucide-react";

export default function FilterHeader({ onClose }: { onClose: () => void }) {
  return (
    <header className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-200">
      <h2
        id="filter-modal-title"
        className="text-[15px] font-semibold text-gray-900"
      >
        Filters
      </h2>

      <button
        type="button"
        onClick={onClose}
        className="p-1 rounded-md text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"
        aria-label="Close filters"
      >
        <X className="h-4 w-4" />
      </button>
    </header>
  );
}
