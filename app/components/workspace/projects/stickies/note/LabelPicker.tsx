import { useState } from "react";
import { Checkbox } from "~/components/ui/checkbox";
import { Check, Plus, Search, Tag as LabelIcon, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { useLabelsQuery } from "~/query/label";
import { useParams } from "react-router";
import { cn } from "~/lib/utils";

interface LabelPickerProps {
  selectedLabelIds: string[];
  onToggleLabel: (labelId: string) => void;
}

export default function LabelPicker({ selectedLabelIds, onToggleLabel }: LabelPickerProps) {
  const { workspaceId } = useParams();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  
  const { data: labels = [] } = useLabelsQuery(workspaceId || "", "sticky");

  const filteredLabels = labels.filter((label) =>
    label.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Labels"
          className={cn(
            "flex items-center text-gray-500 hover:text-gray-700 disabled:opacity-50",
            selectedLabelIds.length > 0 && "text-primary"
          )}
        >
          <LabelIcon size={16} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="flex items-center border-b px-2 pb-2 mb-2">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <input
            className="flex h-4 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Search labels..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="max-h-[200px] overflow-auto py-1 px-1 space-y-1.5">
          {filteredLabels.map((label) => {
            const isSelected = selectedLabelIds.includes(label._id);
            
            return (
              <div
                key={label._id}
                className="flex items-center gap-2.5 group"
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggleLabel(label._id)}
                  className="size-4 shrink-0 rounded-sm border-zinc-300 data-[state=checked]:bg-black data-[state=checked]:border-black"
                />
                <button
                  type="button"
                  onClick={() => onToggleLabel(label._id)}
                  className="h-8 flex-1 rounded-sm transition-all hover:opacity-85 active:scale-[0.98] shadow-none flex items-center px-2.5 cursor-pointer"
                  style={{ backgroundColor: label.color }}
                >
                  {label.name && (
                    <span className="text-[12px] font-bold text-white truncate max-w-full drop-shadow-sm">
                      {label.name}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
          
          {filteredLabels.length === 0 && (
            <div className="py-2 text-center text-xs text-muted-foreground">
              No labels found.
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
