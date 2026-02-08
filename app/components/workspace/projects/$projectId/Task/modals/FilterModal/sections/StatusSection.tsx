import { useState } from "react";
import { ListFilter } from "lucide-react";
import { Label } from "~/components/ui/label";
import { FILTER_STATUSES } from "../../../data/filter.mock";

export default function StatusSection() {
  const [active, setActive] = useState<string[]>([]);

  const toggle = (s: string) => {
    setActive((prev) =>
      prev.includes(s) ? prev.filter((i) => i !== s) : [...prev, s]
    );
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <ListFilter className="h-4 w-4 text-gray-400" />
        <Label className="text-sm font-semibold text-gray-900">Status</Label>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTER_STATUSES.map((s) => {
          const isActive = active.includes(s);

          return (
            <button
              key={s}
              type="button"
              onClick={() => toggle(s)}
              className={`
                relative h-8 px-3 rounded-md border
                text-xs font-medium transition-colors
                ${
                  isActive
                    ? "bg-gray-900 border-gray-900 text-white"
                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }
              `}
            >
              {s}
            </button>
          );
        })}
      </div>
    </section>
  );
}
