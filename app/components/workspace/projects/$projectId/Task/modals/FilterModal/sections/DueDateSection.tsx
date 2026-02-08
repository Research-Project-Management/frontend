import { Calendar } from "lucide-react";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import { DUE_DATE_PRESETS } from "../../../data/filter.mock";

export default function DueDateSection() {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-400" />
          <Label className="text-sm font-semibold text-gray-900">
            Due Date
          </Label>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {DUE_DATE_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              className="
                px-2.5 py-1
                text-[11px] font-medium
                bg-gray-100 text-gray-600
                rounded-md
                hover:bg-gray-200 hover:text-gray-900
                transition-colors
              "
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs uppercase tracking-wide text-gray-500">
            From
          </Label>
          <Input type="date" className="h-9 text-sm" />
        </div>

        <div className="space-y-1">
          <Label className="text-xs uppercase tracking-wide text-gray-500">
            To
          </Label>
          <Input type="date" className="h-9 text-sm" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Checkbox id="overdue" />
          <Label htmlFor="overdue" className="text-sm text-gray-800">
            Overdue items
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="noDue" />
          <Label htmlFor="noDue" className="text-sm text-gray-800">
            No due date
          </Label>
        </div>
      </div>
    </section>
  );
}
