import { useState } from "react";
import { Check, Plus, Search, Tag as TagIcon, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { useTags, useCreateTag } from "~/query/tag";
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
  const createTag = useCreateTag();

  const filteredTags = tags.filter((tag) =>
    tag.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateTag = () => {
    if (!workspaceId || !search.trim()) return;
    
    // Pick a random color or default
    const colors = ["#ef4444", "#f97316", "#f59e0b", "#84cc16", "#10b981", "#06b6d4", "#3b82f6", "#8b5cf6", "#d946ef", "#f43f5e"];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    createTag.mutate({
      workspaceId,
      name: search.trim(),
      color: randomColor
    }, {
        onSuccess: () => {
             setSearch("");
        }
    });
  };

  const exactMatch = tags.some(t => t.name.toLowerCase() === search.trim().toLowerCase());

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
            placeholder="Search or create tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="max-h-[200px] overflow-auto space-y-1">
          {filteredTags.map((tag) => (
            <div
              key={tag._id}
              onClick={() => onToggleTag(tag._id)}
              className="flex items-center justify-between px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <div 
                  className="w-2.5 h-2.5 rounded-full" 
                  style={{ backgroundColor: tag.color }} 
                />
                <span>{tag.name}</span>
              </div>
              {selectedTagIds.includes(tag._id) && (
                <Check className="h-4 w-4 opacity-50" />
              )}
            </div>
          ))}
          
          {filteredTags.length === 0 && !search && (
            <div className="py-2 text-center text-xs text-muted-foreground">
              No tags found.
            </div>
          )}

          {search && !exactMatch && (
             <div
                onClick={handleCreateTag}
                className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer text-muted-foreground"
             >
                <Plus className="h-4 w-4" />
                <span>Create "{search}"</span>
             </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
