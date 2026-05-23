import { FileText, Grid3X3, List, Search, Plus, PenLine, ChevronRight } from "lucide-react";
import React, { useState, useMemo } from "react";
import { useParams } from "react-router";
import PageItem from "./PageItem";
import { useProjects } from "~/hooks/useWorkspace";
import { useWorkspacePages, useProjectPages } from "~/query/page";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import CreatePageDialog from "./CreatePageDialog";
import Topbar from "../$projectId/overview/Topbar";

export default function PagesManager({ projectId }: { projectId?: string }) {
  const { workspaceId } = useParams();
  const { projects } = useProjects();
  const currentProject = projects?.find((p: { _id: string | undefined; }) => p._id === projectId);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

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
    return [...filtered].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [allPages, searchQuery]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="sticky top-0 z-10 bg-background border-b border-border px-6 py-3 flex justify-between items-center">
          <div className="flex gap-3 items-center">
            <Skeleton className="h-8 w-48 rounded-md" />
            <Skeleton className="h-8 w-40 rounded-md" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-28 rounded-md" />
          </div>
        </div>
        <div className="flex-1 px-6 py-6">
          <Skeleton className="h-3 w-24 mb-5" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-[3/4] w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (error)
    return <div className="p-6 text-destructive">Failed to load pages</div>;

  return (
    <div className="flex flex-col h-full bg-background">
      <Topbar
        project={projectId && currentProject ? { name: currentProject.name, avatar: currentProject.avatar } : undefined}
        title={projectId ? "Pages" : "All Pages"}
        Icon={PenLine}
        actions={
          <div className="flex items-center gap-3">
            {/* Search */}
            <div
              className={cn(
                "relative flex items-center transition-all duration-300 ease-in-out h-8 rounded-sm overflow-hidden group",
                isSearchExpanded || searchQuery ? "w-64 border border-border/50 bg-background" : "w-8 hover:bg-secondary/80 cursor-pointer"
              )}
              onClick={() => !isSearchExpanded && setIsSearchExpanded(true)}
            >
              <Search 
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 size-3.5 transition-all duration-300 z-10",
                  isSearchExpanded || searchQuery 
                    ? "left-2.5 translate-x-0 text-muted-foreground/50" 
                    : "left-1/2 -translate-x-1/2 text-muted-foreground group-hover:text-foreground"
                )} 
              />
              <Input
                autoFocus={isSearchExpanded}
                type="text"
                placeholder="Search by title"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onBlur={() => !searchQuery && setIsSearchExpanded(false)}
                className={cn(
                  "h-full text-[13px] py-0 leading-none border-none bg-transparent focus-visible:ring-0 shadow-none w-full placeholder:text-muted-foreground/50 transition-all pl-8 pr-8",
                  isSearchExpanded || searchQuery ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
              />
              {(isSearchExpanded || searchQuery) && (
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchQuery("");
                    setIsSearchExpanded(false);
                  }}
                  className="absolute right-2.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                >
                  <Plus className="size-3.5 rotate-45" />
                </button>
              )}
            </div>

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
        }
      />

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
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_200px_160px_60px] gap-4 px-5 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 select-none">
              <span>Title</span>
              <span>Project</span>
              <span>Last modified</span>
              <span />
            </div>
            <div className="flex flex-col gap-2.5">
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
