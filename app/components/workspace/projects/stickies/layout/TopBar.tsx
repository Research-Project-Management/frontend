import { useState, useEffect } from "react";
import { Layers2, Plus, Search, Filter, ChevronRight } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import { useTags } from "~/query/tag";
import { useParams } from "react-router";
import { useProjects } from "~/hooks/useWorkspace";
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
  const { workspaceId, projectId } = useParams();
  const { projects } = useProjects();
  const currentProject = projects?.find((p: { _id: string | undefined; }) => p._id === projectId);

  const [manageTagsOpen, setManageTagsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange?.(searchValue);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchValue, onSearchChange]);


  const { data: tags = [] } = useTags(workspaceId || "");
  const handleTagToggle = (tagId: string, checked: boolean) => {
    if (checked) {
      onTagFilterChange([...selectedTags, tagId]);
    } else {
      onTagFilterChange(selectedTags.filter((id) => id !== tagId));
    }
  };

  return (
    <header className="flex items-center justify-between px-4 h-13 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
      <div 
        className="flex items-center gap-2.5"
        style={{ paddingLeft: "var(--header-offset, 0px)" }}
      >
        {projectId && currentProject ? (
          <>
            <div className="flex items-center gap-2">
              <span className="text-base leading-none">
                {currentProject.avatar}
              </span>
              <span className="text-sm font-semibold text-primary truncate max-w-[120px]">
                {currentProject.name}
              </span>
            </div>
            <ChevronRight className="size-3.5 text-muted-foreground/50" />
          </>
        ) : null}
        <div className="flex items-center gap-2">
          <Layers2 className="size-4.5 text-primary" />
          <h1 className="text-sm font-semibold text-primary transition-all duration-300">
            Stickies
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {/* Tag Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8 rounded-sm hover:bg-muted text-muted-foreground">
                <Filter className="h-4 w-4" />
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

          {/* Search */}
          <div
            className={cn(
              "relative flex items-center transition-all duration-300 ease-in-out overflow-hidden h-8",
              isSearchExpanded ? "w-64" : "w-8",
            )}
          >
            {isSearchExpanded ? (
              <div className="relative w-full">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  autoFocus
                  type="text"
                  placeholder="Search by title"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onBlur={() => !searchValue && setIsSearchExpanded(false)}
                  className="pl-8 pr-8 h-8! text-[13px] rounded-sm border border-border/60 bg-background focus-visible:ring-0 shadow-none placeholder:text-muted-foreground/60"
                />
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setSearchValue("");
                    setIsSearchExpanded(false);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground"
                >
                  <Plus className="size-3.5 rotate-45" />
                </button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 hover:bg-muted"
                onClick={() => setIsSearchExpanded(true)}
              >
                <Search className="size-4 text-muted-foreground" />
              </Button>
            )}
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

        <Button 
          type="button" 
          size="sm" 
          onClick={onAddNote}
          className="h-8 gap-1.5 rounded-sm px-3 text-xs shadow-none transition-all hover:brightness-110"
        >
          <Plus className="size-3.5" />
          Add Sticky
        </Button>
      </div>
    </header>
  );
}
