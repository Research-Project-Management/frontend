import { useState } from "react";
import { Tag } from "lucide-react";
import { Label } from "~/components/ui/label";
import { FILTER_LABELS } from "../../../data/filter.mock";

export default function LabelsSection() {
  const [active, setActive] = useState<string[]>([]);

  const toggle = (l: string) => {
    setActive((prev) =>
      prev.includes(l) ? prev.filter((i) => i !== l) : [...prev, l]
    );
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Tag className="h-4 w-4 text-gray-400" />
        <Label className="text-sm font-semibold text-gray-900">Labels</Label>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTER_LABELS.map((lb) => {
          const isActive = active.includes(lb);

          return (
            <button
              key={lb}
              type="button"
              onClick={() => toggle(lb)}
              className={`
                relative h-8 px-3 rounded-md border
                text-xs font-medium transition-colors
                inline-flex items-center justify-center
                ${
                  isActive
                    ? "bg-gray-900 border-gray-900 text-white"
                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }
              `}
            >
              {lb}
            </button>
          );
        })}
      </div>
    </section>
  );
}
