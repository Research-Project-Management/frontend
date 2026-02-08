import { Search, Users } from "lucide-react";

import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";

import {
  FILTER_ASSIGNEES,
  FILTER_ASSIGNEES_COUNT,
} from "../../../data/filter.mock";

export default function AssigneeSection() {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-gray-400" />
          <Label className="text-sm font-semibold text-gray-900">
            Assignee
          </Label>
        </div>

        <button
          type="button"
          className="
            h-7 px-3 rounded-md
            border border-gray-200
            bg-white
            text-xs font-medium text-gray-600
            hover:bg-gray-100 hover:text-gray-900
            transition-colors
          "
        >
          Me
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search members..."
          className="h-9 pl-9 text-[13px]"
        />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox id="unassigned" />
        <Label
          htmlFor="unassigned"
          className="text-sm font-medium text-gray-800"
        >
          Unassigned
        </Label>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
          {FILTER_ASSIGNEES_COUNT}
        </span>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-1">
        <div className="max-h-[150px] overflow-y-auto space-y-1">
          {FILTER_ASSIGNEES.map((name) => (
            <button
              key={name}
              type="button"
              className="
                group w-full flex items-center justify-between
                rounded-md px-3 py-2
                hover:bg-gray-100 transition-colors
              "
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-7 w-7 shrink-0 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-xs font-semibold text-gray-500">
                  {name === "…" ? "…" : name.slice(0, 1).toUpperCase()}
                </div>
                <span className="truncate text-sm text-gray-600 group-hover:text-gray-900">
                  {name}
                </span>
              </div>
              <Checkbox />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
