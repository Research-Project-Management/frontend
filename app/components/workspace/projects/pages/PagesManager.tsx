import { PenLine, Grid3X3, List, Search, Loader2 } from "lucide-react";
import React, { useState } from "react";
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

  const { data: wPages, isLoading: wLoading, error: wError } = useWorkspacePages(
    workspaceId!, 
    statusFilter, 
    searchQuery,
    { enabled: !projectId }
  );

  const { data: pPages, isLoading: pLoading, error: pError } = useProjectPages(
    projectId!,
    statusFilter,
    searchQuery,
    { enabled: !!projectId }
  );

  const pages = projectId ? pPages : wPages;
  const isLoading = projectId ? pLoading : wLoading;
  const error = projectId ? pError : wError;

  if (isLoading) return <Loading />;
  if (error) return <div className="p-6 text-red-500">Failed to load pages</div>;

  return (
    <div className="flex flex-col h-full">
      <Header title={projectId ? "Project Pages" : "All Pages"} Icon={PenLine} />
      
      <div className="flex-1 p-6 space-y-8 overflow-y-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search pages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-background border border-input hover:border-primary/50 focus:border-primary transition-colors"
                />
              </div>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger size="sm" className="w-[140px] bg-background border border-input hover:border-primary/50 transition-colors focus:ring-0">
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
              <div className="flex items-center bg-secondary/20 rounded-lg p-1">
                  <Button 
                      variant="ghost" 
                      size="icon" 
                      className={`h-8 w-8 rounded-md ${viewMode === "grid" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      onClick={() => setViewMode("grid")}
                  >
                      <Grid3X3 className="w-4 h-4" />
                  </Button>
                  <Button 
                      variant="ghost" 
                      size="icon" 
                      className={`h-8 w-8 rounded-md ${viewMode === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      onClick={() => setViewMode("list")}
                  >
                      <List className="w-4 h-4" />
                  </Button>
              </div>

              {/* Add Button */}
              <CreatePageDialog defaultProjectId={projectId} />
            </div>
          </div>

          {/* Pages Grid/List */}
          {!pages || pages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <PenLine className="w-12 h-12 mb-4 opacity-20" />
              <p>No pages found</p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {pages.map((page) => (
                <PageItem key={page._id} page={page} viewMode={viewMode} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {pages.map((page) => (
                <PageItem key={page._id} page={page} viewMode={viewMode} />
              ))}
            </div>
          )}
      </div>
    </div>
  );
}
