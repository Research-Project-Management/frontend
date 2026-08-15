'use client';

import React, { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { Plus, FolderKanban } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
  Skeleton,
} from "@/shared/components/ui";
import { CreateProjectModal } from "../components/modals/CreateProjectModal";
import { useProjects } from "../hooks/use-project";
import { Topbar } from "../components/layout/Topbar";
import { Card } from "../components/card/Card";

function ProjectCardSkeleton() {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card overflow-hidden h-48 animate-pulse">
      <div className="h-24 bg-muted/40" />
      <div className="pt-6 px-4 pb-4 space-y-2.5">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function ProjectsPage() {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params.workspaceId;
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { projects: rawProjects = [], isLoading } = useProjects(workspaceId);

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return rawProjects;
    const q = searchQuery.toLowerCase().trim();
    return rawProjects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        ((p as any).key && (p as any).key.toLowerCase().includes(q))
    );
  }, [rawProjects, searchQuery]);

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Topbar */}
      <Topbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onAddProjectClick={() => setIsCreateOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Loading state */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProjectCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Loaded Projects */}
        {!isLoading && filteredProjects.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProjects.map((project) => (
              <Card
                key={project._id}
                project={project}
                workspaceId={workspaceId}
              />
            ))}
          </div>
        )}

        {/* Empty state: 0 projects in workspace */}
        {!isLoading && rawProjects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="size-12 rounded-2xl bg-muted/50 border border-border flex items-center justify-center text-foreground">
              <FolderKanban className="size-6 text-foreground" />
            </div>
            <div className="space-y-1 max-w-sm">
              <h3 className="text-base font-semibold text-foreground">No projects yet</h3>
              <p className="text-xs text-muted-foreground">
                Projects help you organize research tasks, cycles, notes, and datasets in one place.
              </p>
            </div>
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="gap-2 text-xs font-semibold cursor-pointer"
            >
              <Plus className="size-4" />
              Create your first project
            </Button>
          </div>
        )}

        {/* Empty state: Search query matched 0 projects */}
        {!isLoading && rawProjects.length > 0 && filteredProjects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="size-12 rounded-2xl bg-muted/50 border border-border flex items-center justify-center text-foreground">
              <FolderKanban className="size-6 text-foreground" />
            </div>
            <div className="space-y-1 max-w-sm">
              <h3 className="text-base font-semibold text-foreground">No matching projects</h3>
              <p className="text-xs text-muted-foreground">
                Try adjusting your search query or clear the search input.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchQuery("")}
              className="text-xs cursor-pointer"
            >
              Clear search
            </Button>
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="sm:max-w-xl bg-popover"
        >
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-foreground">New Project</DialogTitle>
          </DialogHeader>
          <CreateProjectModal onSuccess={() => setIsCreateOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ProjectsPage;
