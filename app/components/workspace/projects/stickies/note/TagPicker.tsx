import { useState } from "react";
import { Checkbox } from "~/components/ui/checkbox";
import { Check, Plus, Search, Tag as TagIcon, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { useTags } from "~/query/tag";
import { useParams } from "react-router";
import { cn } from "~/lib/utils";

interface TagPickerProps {
  selectedTagIds: string[];
  onToggleTag: (tagId: string) => void;
}

export default function TagPicker({ selectedTagIds, onToggleTag }: TagPickerProps) {
  const { workspaceId } = useParams();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  
  const { data: tags = [] } = useTags(workspaceId || "");

  const filteredTags = tags.filter((tag) =>
    tag.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Tags"
          className={cn(
            "flex items-center text-gray-500 hover:text-gray-700 disabled:opacity-50",
            selectedTagIds.length > 0 && "text-primary"
          )}
        >
          <TagIcon size={16} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="flex items-center border-b px-2 pb-2 mb-2">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <input
            className="flex h-4 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Search tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="max-h-[200px] overflow-auto py-1 px-1 space-y-1.5">
          {filteredTags.map((tag) => {
            const isSelected = selectedTagIds.includes(tag._id);
            
            return (
              <div
                key={tag._id}
                className="flex items-center gap-2.5 group"
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggleTag(tag._id)}
                  className="size-4 shrink-0 rounded-sm border-zinc-300 data-[state=checked]:bg-black data-[state=checked]:border-black"
                />
                <button
                  type="button"
                  onClick={() => onToggleTag(tag._id)}
                  className="h-8 flex-1 rounded-sm transition-all hover:opacity-85 active:scale-[0.98] shadow-none flex items-center px-2.5 cursor-pointer"
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.name && (
                    <span className="text-[12px] font-bold text-white truncate max-w-full drop-shadow-sm">
                      {tag.name}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
          
          {filteredTags.length === 0 && (
            <div className="py-2 text-center text-xs text-muted-foreground">
              No tags found.
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
