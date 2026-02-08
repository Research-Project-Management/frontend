import { RotateCcw } from "lucide-react";
import { Button } from "~/components/ui/button";

export default function FilterFooter({ onReset }: { onReset: () => void }) {
  return (
    <footer className="shrink-0 border-t border-gray-200 px-4 py-2 bg-white">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onReset}
          className="
            inline-flex items-center gap-2
            text-sm font-medium text-gray-600
            hover:text-gray-900 hover:bg-gray-100
            rounded-md px-3 py-2
            transition-colors
          "
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </button>

        <Button type="submit" className="h-10 px-6 text-sm font-medium">
          Apply
        </Button>
      </div>
    </footer>
  );
}
