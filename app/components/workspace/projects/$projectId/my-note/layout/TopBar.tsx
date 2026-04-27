import { useState, useEffect, useRef } from "react";
import { Layers2, Plus, Search, X, Filter } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useTags } from "~/query/tag";
import { useParams } from "react-router";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import ManageTagsModal from "../modals/ManageTagsModal";

interface TopBarProps {
  onAddNote: () => void;
  selectedTags: string[];
  onTagFilterChange: (tags: string[]) => void;
  savingStatus?: "saved" | "saving" | "error";
  lastSavedAt?: Date | null;
  onSearchChange?: (val: string) => void;
}

export default function TopBar({
  onAddNote,
  selectedTags,
  onTagFilterChange,
  savingStatus = "saved",
  lastSavedAt,
  onSearchChange,
}: TopBarProps) {
  const { workspaceId } = useParams();
  const [open, setOpen] = useState(false);
  const [manageTagsOpen, setManageTagsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange?.(searchValue);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchValue, onSearchChange]);

  // Note: Tags might still be project-scoped or need refactor.
  // For now, passing workspaceId where projectId was expected if compatible,
  // or we need to update search/filter for workspace.
  // Assuming we use workspaceId for now.
  const { data: tags = [] } = useTags(workspaceId || "");

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  const handleTagToggle = (tagId: string, checked: boolean) => {
    if (checked) {
      onTagFilterChange([...selectedTags, tagId]);
    } else {
      onTagFilterChange(selectedTags.filter((id) => id !== tagId));
    }
  };

  return (
    <header className="shrink-0 border-b bg-white ml-2 mr-2">
      <div className="flex items-center gap-2 p-2">
        <h1 className="flex items-center gap-2 font-semibold text-primary">
          Stickies
        </h1>
        <div className="ml-auto flex items-center gap-2">
          {/* Tag Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1">
                <Filter className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  Filter
                </span>
                {selectedTags.length > 0 && (
                  <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                    {selectedTags.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
              <DropdownMenuLabel>Filter by Tag</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {tags.length === 0 ? (
                <div className="p-2 text-xs text-muted-foreground text-center">
                  No tags available
                </div>
              ) : (
                tags.map((tag) => (
                  <DropdownMenuCheckboxItem
                    key={tag._id}
                    checked={selectedTags.includes(tag._id)}
                    onCheckedChange={(checked) =>
                      handleTagToggle(tag._id, checked)
                    }
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span>{tag.name}</span>
                    </div>
                  </DropdownMenuCheckboxItem>
                ))
              )}
              {selectedTags.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-center h-8 font-normal"
                    onClick={() => onTagFilterChange([])}
                  >
                    Clear filters
                  </Button>
                </>
              )}
              <DropdownMenuSeparator />
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start h-8 font-normal"
                onClick={() => setManageTagsOpen(true)}
              >
                Manage Tags...
              </Button>
            </DropdownMenuContent>
          </DropdownMenu>

          <ManageTagsModal
            open={manageTagsOpen}
            onClose={() => setManageTagsOpen(false)}
          />

          <div className="relative flex items-center">
            {!open && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setOpen(true)}
              >
                <Search className="h-4 w-4" />
              </Button>
            )}

            <div
              className={`
                relative flex items-center overflow-hidden
                transition-all duration-200 ease-out
                ${open ? "w-48 md:w-64 opacity-100" : "w-0 opacity-0"}
              `}
            >
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

              <Input
                ref={inputRef}
                type="text"
                placeholder="Search stickies..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="h-8 w-full pl-8 pr-8 focus-visible:ring-0"
              />

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="
                  absolute right-1 top-1/2 -translate-y-1/2
                  hover:bg-transparent
                  hover:text-inherit
                  active:bg-transparent
                  focus-visible:ring-0
                "
                onClick={() => setOpen(false)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-2 text-xs text-muted-foreground border-l h-4">
            {savingStatus === "saving" && (
              <span className="flex items-center gap-1.5 animate-pulse text-amber-600">
                <div className="h-1.5 w-1.5 rounded-full bg-amber-600" />
                Saving...
              </span>
            )}
            {savingStatus === "saved" && lastSavedAt && (
              <span className="flex items-center gap-1.5 text-emerald-600">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                Saved
              </span>
            )}
            {savingStatus === "error" && (
              <span className="flex items-center gap-1.5 text-destructive font-medium">
                <div className="h-1.5 w-1.5 rounded-full bg-destructive" />
                Save Error
              </span>
            )}
          </div>

          <Button type="button" size="sm" onClick={onAddNote}>
            <Plus className="h-4 w-4" />
            Add Sticky
          </Button>
        </div>
      </div>
    </header>
  );
}
