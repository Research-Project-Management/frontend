import { FileText, Grid3X3, List, Search, Plus } from "lucide-react";
import React, { useState, useMemo } from "react";
import { useParams } from "react-router";
import PageItem from "./PageItem";
import { useWorkspacePages, useProjectPages } from "~/query/page";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import Loading from "~/components/ui/Loading";
import CreatePageDialog from "./CreatePageDialog";
import { cn } from "~/lib/utils";

type SortOption = "modified" | "created" | "title";

export default function PagesManager({ projectId }: { projectId?: string }) {
  const { workspaceId } = useParams();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("modified");

  const {
    data: wPages,
    isLoading: wLoading,
    error: wError,
  } = useWorkspacePages(workspaceId!, "all", undefined, {
    enabled: !projectId,
  });
  const {
    data: pPages,
    isLoading: pLoading,
    error: pError,
  } = useProjectPages(projectId!, "all", undefined, { enabled: !!projectId });

  const allPages = projectId ? pPages : wPages;
  const isLoading = projectId ? pLoading : wLoading;
  const error = projectId ? pError : wError;

  const pages = useMemo(() => {
    if (!allPages) return [];
    let filtered = allPages;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((p) => p.title?.toLowerCase().includes(q));
    }
    return [...filtered].sort((a, b) => {
      if (sortBy === "title") return a.title.localeCompare(b.title);
      if (sortBy === "created")
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [allPages, searchQuery, sortBy]);

  if (isLoading) return <Loading />;
  if (error)
    return <div className="p-6 text-red-500">Failed to load pages</div>;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* ── Sticky top bar ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-6 py-3 flex justify-between items-center">
        <div className="flex gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search pages…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-8! text-sm"
            />
          </div>

          {/* Sort */}
          <Select
            value={sortBy}
            onValueChange={(v) => setSortBy(v as SortOption)}
          >
            <SelectTrigger className="w-40 h-8! text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="modified">Last modified</SelectItem>
              <SelectItem value="created">Date created</SelectItem>
              <SelectItem value="title">Title (A–Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex items-center h-8 rounded-md border border-border overflow-hidden shrink-0">
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "p-2 transition-colors",
                viewMode === "grid"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              <Grid3X3 className="size-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "p-2 transition-colors",
                viewMode === "list"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              <List className="size-4" />
            </button>
          </div>
          <CreatePageDialog defaultProjectId={projectId} />
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Count */}
        {pages.length > 0 && (
          <p className="text-xs text-muted-foreground mb-5">
            {pages.length} document{pages.length !== 1 ? "s" : ""}
          </p>
        )}

        {pages.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <div className="size-20 rounded-2xl bg-muted flex items-center justify-center mb-5">
              <FileText className="size-9 opacity-30" />
            </div>
            <p className="font-medium mb-1">
              {searchQuery ? "No results found" : "No documents yet"}
            </p>
            <p className="text-sm text-muted-foreground/70 mb-6">
              {searchQuery
                ? "Try a different search term"
                : "Create your first LaTeX document to get started"}
            </p>
            {!searchQuery && <CreatePageDialog defaultProjectId={projectId} />}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
            {pages.map((page) => (
              <PageItem key={page._id} page={page} viewMode="grid" />
            ))}
          </div>
        ) : (
          /* List view with column header */
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-[1fr_180px_140px_40px] gap-2 px-4 py-2 bg-muted/40 text-xs font-medium text-muted-foreground border-b border-border select-none">
              <span>Title</span>
              <span>Project</span>
              <span>Last modified</span>
              <span />
            </div>
            <div className="divide-y divide-border">
              {pages.map((page) => (
                <PageItem key={page._id} page={page} viewMode="list" />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
