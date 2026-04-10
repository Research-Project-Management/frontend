import {
  Search,
  Grid3x3,
  List,
  Upload,
  FolderPlus,
  ArrowUpDown,
  Filter,
  FolderOpen,
  X,
  FileText,
  Image,
  Video,
  Music,
  Archive,
  Layers2,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
  DropdownMenuGroup,
} from "~/components/ui/dropdown-menu";
import { useState } from "react";

type SourceFilter =
  | { kind: "all" }
  | { kind: "workspace" }
  | { kind: "shared" }
  | { kind: "project"; projectId: string; projectName: string };

type ToolbarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  sourceFilter?: SourceFilter;
  projectOptions?: Array<{ value: string; label: string }>;
  onSourceChange?: (value: SourceFilter) => void;
  viewMode: "grid" | "list";
  onToggleView: () => void;
  actionLabel?: string;
  onUpload?: () => void;
  onCreateFolder?: () => void;
};

type SortOption = "name" | "date" | "size" | "type";
type FileTypeFilter =
  | "all"
  | "documents"
  | "images"
  | "videos"
  | "audio"
  | "archives";

export default function Toolbar({
  searchValue,
  onSearchChange,
  sourceFilter = { kind: "all" },
  projectOptions = [],
  onSourceChange,
  viewMode,
  onToggleView,
  onUpload,
  onCreateFolder,
}: ToolbarProps) {
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [filterType, setFilterType] = useState<FileTypeFilter>("all");

  const isSourceSelected = sourceFilter.kind !== "all";

  return (
    <div className="flex flex-col gap-3 mb-4">
      {/* Top Bar: Search + Actions */}
      <div className="flex items-center justify-between gap-3">
        {/* Search - Google Drive style */}
        <div className="relative flex-1 max-w-2xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search in storage"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 h-10 bg-muted/30 border-0 hover:bg-muted/50 focus:bg-background focus:border focus:border-input transition-colors"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5">
          {onUpload && (
            <Button onClick={onUpload} size="sm" className="gap-2 h-10">
              <Upload className="size-4" />
              <span className="hidden sm:inline">Upload</span>
            </Button>
          )}

          {onCreateFolder && (
            <Button
              onClick={onCreateFolder}
              variant="outline"
              size="sm"
              className="gap-2 h-10 border-border/50 hover:border-border"
            >
              <FolderPlus className="size-4" />
              <span className="hidden sm:inline">New Folder</span>
            </Button>
          )}
        </div>
      </div>

      {/* Bottom Bar: Filters + View */}
      <div className="flex items-center justify-between gap-3">
        {/* Left: Sort & Filter */}
        <div className="flex items-center gap-2">
          {/* Sort Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 h-9 text-muted-foreground hover:text-foreground"
              >
                <ArrowUpDown className="size-4" />
                <span className="text-xs font-normal">
                  {sortBy === "name" && "Name"}
                  {sortBy === "date" && "Modified"}
                  {sortBy === "size" && "Size"}
                  {sortBy === "type" && "Type"}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={sortBy === "name"}
                onCheckedChange={() => setSortBy("name")}
              >
                Name
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={sortBy === "date"}
                onCheckedChange={() => setSortBy("date")}
              >
                Last modified
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={sortBy === "size"}
                onCheckedChange={() => setSortBy("size")}
              >
                File size
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={sortBy === "type"}
                onCheckedChange={() => setSortBy("type")}
              >
                Type
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Type Filter Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 h-9 text-muted-foreground hover:text-foreground"
              >
                <Filter className="size-4" />
                <span className="text-xs font-normal">
                  {filterType === "all" && "All types"}
                  {filterType === "documents" && "Documents"}
                  {filterType === "images" && "Images"}
                  {filterType === "videos" && "Videos"}
                  {filterType === "audio" && "Audio"}
                  {filterType === "archives" && "Archives"}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel>File type</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={filterType === "all"}
                onCheckedChange={() => setFilterType("all")}
              >
                All types
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filterType === "documents"}
                onCheckedChange={() => setFilterType("documents")}
              >
                <FileText className="size-4 mr-2" />
                Documents
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filterType === "images"}
                onCheckedChange={() => setFilterType("images")}
              >
                <Image className="size-4 mr-2" />
                Images
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filterType === "videos"}
                onCheckedChange={() => setFilterType("videos")}
              >
                <Video className="size-4 mr-2" />
                Videos
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filterType === "audio"}
                onCheckedChange={() => setFilterType("audio")}
              >
                <Music className="size-4 mr-2" />
                Audio
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filterType === "archives"}
                onCheckedChange={() => setFilterType("archives")}
              >
                <Archive className="size-4 mr-2" />
                Archives
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Source Filter */}
          <DropdownMenu>
            <div
              className={`inline-flex h-9 items-center overflow-hidden rounded-md transition-colors ${
                isSourceSelected
                  ? "bg-accent/70 text-foreground"
                  : "bg-transparent text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              }`}
            >
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-full items-center gap-1.5 px-3 text-xs font-normal outline-none"
                >
                  <Layers2 className="size-4 shrink-0" />
                  <span className="max-w-28 truncate">Source</span>
                </button>
              </DropdownMenuTrigger>

              {isSourceSelected && onSourceChange && (
                <>
                  <div className="h-4 w-px bg-border/70" />
                  <button
                    type="button"
                    aria-label="Clear source filter"
                    className="inline-flex h-full w-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground rounded-md"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onSourceChange({ kind: "all" });
                    }}
                  >
                    <X className="size-3.5" />
                  </button>
                </>
              )}
            </div>

            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>Source</DropdownMenuLabel>
              <DropdownMenuSeparator />

              <DropdownMenuGroup>
                <DropdownMenuCheckboxItem
                  checked={sourceFilter.kind === "workspace"}
                  onCheckedChange={() => onSourceChange?.({ kind: "workspace" })}
                >
                  Workspace
                </DropdownMenuCheckboxItem>

                <DropdownMenuCheckboxItem
                  checked={sourceFilter.kind === "shared"}
                  onCheckedChange={() => onSourceChange?.({ kind: "shared" })}
                >
                  Shared
                </DropdownMenuCheckboxItem>
              </DropdownMenuGroup>

              <DropdownMenuGroup>
                {projectOptions.length === 0 ? (
                  <DropdownMenuCheckboxItem disabled checked={false}>
                    No projects
                  </DropdownMenuCheckboxItem>
                ) : (
                  projectOptions.map((project) => (
                    <DropdownMenuCheckboxItem
                      key={project.value}
                      checked={
                        sourceFilter.kind === "project" &&
                        sourceFilter.projectId === project.value
                      }
                      onCheckedChange={() =>
                        onSourceChange?.({
                          kind: "project",
                          projectId: project.value,
                          projectName: project.label,
                        })
                      }
                    >
                      {project.label}
                    </DropdownMenuCheckboxItem>
                  ))
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Right: View Toggle - Google Drive style */}
        <div className="flex items-center gap-0.5 bg-muted/30 rounded-lg p-1">
          <Button
            onClick={() => viewMode === "list" && onToggleView()}
            variant="ghost"
            size="icon"
            className={`h-7 w-7 rounded-md transition-colors ${
              viewMode === "grid"
                ? "bg-background text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-transparent"
            }`}
            title="Grid view"
          >
            <Grid3x3 className="size-4" />
          </Button>
          <Button
            onClick={() => viewMode === "grid" && onToggleView()}
            variant="ghost"
            size="icon"
            className={`h-7 w-7 rounded-md transition-colors ${
              viewMode === "list"
                ? "bg-background text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-transparent"
            }`}
            title="List view"
          >
            <List className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}