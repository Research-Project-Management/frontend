import { PenLine, Grid3X3, List, Search, Loader2 } from "lucide-react";
import React, { useState, useMemo } from "react";
import { useParams } from "react-router";
import PageItem from "./PageItem";
import { useWorkspacePages, useProjectPages } from "~/query/page";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import Loading from "~/components/ui/Loading";
import CreatePageDialog from "./CreatePageDialog";
import Header from "../layout/Header";

export default function PagesManager({ projectId }: { projectId?: string }) {
  const { workspaceId } = useParams();
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Fetch all pages without search (client-side filtering)
  const { data: wPages, isLoading: wLoading, error: wError } = useWorkspacePages(
    workspaceId!, 
    statusFilter,
    undefined, // No search query - filter client-side
    { enabled: !projectId }
  );

  const { data: pPages, isLoading: pLoading, error: pError } = useProjectPages(
    projectId!,
    statusFilter,
    undefined, // No search query - filter client-side
    { enabled: !!projectId }
  );

  const allPages = projectId ? pPages : wPages;
  const isLoading = projectId ? pLoading : wLoading;
  const error = projectId ? pError : wError;

  // Client-side filtering for instant search
  const pages = useMemo(() => {
    if (!allPages) return [];
    if (!searchQuery) return allPages;
    
    const query = searchQuery.toLowerCase();
    return allPages.filter(page => 
      page.title?.toLowerCase().includes(query)
    );
  }, [allPages, searchQuery]);

  if (isLoading) return <Loading />;
  if (error) return <div className="p-6 text-red-500">Failed to load pages</div>;

  return (
    <div className="flex flex-col h-full">
      <Header title={projectId ? "Project Pages" : "All Pages"} Icon={PenLine} />
      
      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                type="text"
                placeholder="Search pages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 bg-background border-gray-200"
              />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px] h-9 border-gray-200">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {/* View Toggle */}
            <div className="flex items-center gap-1 bg-secondary/20 p-1 rounded-lg">
              <Button 
                variant="ghost" 
                size="icon" 
                className={`h-8 w-8 ${viewMode === "grid" ? "bg-background shadow-sm" : ""}`}
                onClick={() => setViewMode("grid")}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className={`h-8 w-8 ${viewMode === "list" ? "bg-background shadow-sm" : ""}`}
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>

            {/* Add Button */}
            <CreatePageDialog defaultProjectId={projectId} />
          </div>
        </div>

        {/* Pages Grid/List */}
        {!pages || pages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <PenLine className="w-12 h-12 mb-4 opacity-20" />
            <p>{searchQuery ? "No pages match your search" : "No pages found"}</p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {pages.map((page) => (
              <PageItem key={page._id} page={page} viewMode={viewMode} />
            ))}
          </div>
        ) : (
          <div className="grid gap-2">
            {pages.map((page) => (
              <PageItem key={page._id} page={page} viewMode={viewMode} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
