import FilterHeader from "./FilterHeader";
import FilterBody from "./FilterBody";
import FilterFooter from "./FilterFooter";
import { useState } from "react";

export type FilterModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onApply: () => void;
};

export default function FilterModal({
  isOpen,
  onClose,
  onApply,
}: FilterModalProps) {
  const [reset, setReset] = useState(0);
  if (!isOpen) return null;

  const handleReset = () => {
    setReset((prev) => prev + 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/15 backdrop-blur-[0.5px]"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="filter-modal-title"
        className="
          relative z-50
          w-full max-w-[560px]
          max-h-[75dvh]
          bg-white
          border border-gray-200
          rounded-lg
          shadow-lg
          flex flex-col
          overflow-hidden
          animate-in fade-in zoom-in-95 duration-200
        "
      >
        <FilterHeader onClose={onClose} />
        <form
          className="flex flex-1 min-h-0 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            onApply();
            onClose();
          }}
        >
          <FilterBody key={reset} />
          <FilterFooter onReset={handleReset} />
        </form>
      </div>
    </div>
  );
}
