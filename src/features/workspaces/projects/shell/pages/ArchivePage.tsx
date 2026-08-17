'use client';

import React, { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Archive } from 'lucide-react';
import { Button, Skeleton } from '@/shared/components/ui';
import { useAuth } from '@/features/auth';
import { useProjects, useRestoreProject, useDeleteProject } from '../hooks/use-project';
import {
  filterArchivedProjects,
  searchArchivedProjects,
} from '../utils/archive-page.util';
import {
  filterProjectsByCriteria,
  type ProjectFilterCriteria,
} from '../utils/projects-page.util';
import { ArchiveCard } from '../components/archived/ArchiveCard';
import { ArchiveTopbar } from '../components/archived/ArchiveTopbar';
import { DeletePermanentModal } from '../components/archived/DeletePermanentModal';
import { ArchivedEmptyState } from '../components/archived/ArchivedEmptyState';
import type { Project } from '../types/project.types';

function ArchiveCardSkeleton() {
  return (
    <div className="flex flex-col rounded-lg border border-border bg-card overflow-hidden h-48 animate-pulse">
      <div className="h-24 bg-muted/40" />
      <div className="pt-6 px-4 pb-4 space-y-2.5">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function ArchivePage() {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params.workspaceId;
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [popoverFilter, setPopoverFilter] = useState<ProjectFilterCriteria>({
    myProjects: false,
    access: [],
    leads: [],
    members: [],
    createdDate: 'all',
  });
  const [deleteConfirmProject, setDeleteConfirmProject] = useState<Project | null>(null);

  const { projects: rawProjects = [], isLoading } = useProjects(workspaceId);
  const restoreProjectMutation = useRestoreProject();
  const deleteProjectMutation = useDeleteProject();

  const archivedProjects = useMemo(() => {
    return filterArchivedProjects(rawProjects);
  }, [rawProjects]);

  const filteredProjects = useMemo(() => {
    const byCriteria = filterProjectsByCriteria(
      archivedProjects,
      popoverFilter,
      user?._id || (user as any)?.id
    );
    return searchArchivedProjects(byCriteria, searchQuery);
  }, [archivedProjects, popoverFilter, searchQuery, user]);

  const handleRestore = (projectId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    restoreProjectMutation.mutate({ projectId });
  };

  const handleDeletePermanent = () => {
    if (!deleteConfirmProject) return;
    const projId = deleteConfirmProject._id || (deleteConfirmProject as any).id;
    if (!projId) return;

    deleteProjectMutation.mutate(
      { projectId: projId },
      {
        onSettled: () => setDeleteConfirmProject(null),
      }
    );
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Topbar */}
      <ArchiveTopbar
        workspaceId={workspaceId}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        totalCount={archivedProjects.length}
        isLoading={isLoading}
        projects={archivedProjects}
        filter={popoverFilter}
        onFilterChange={setPopoverFilter}
        currentUserId={user?._id || (user as any)?.id}
        currentUserName={user?.name || 'You'}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 min-w-0">
        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <ArchiveCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Grid of Archived Projects */}
        {!isLoading && filteredProjects.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProjects.map((project) => {
              const projectId = project._id || (project as any).id || '';
              return (
                <ArchiveCard
                  key={projectId}
                  project={project}
                  workspaceId={workspaceId}
                  onRestore={handleRestore}
                  onDeletePermanent={(p: Project, e: React.MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDeleteConfirmProject(p);
                  }}
                  isRestoring={restoreProjectMutation.isPending}
                />
              );
            })}
          </div>
        )}

        {/* Empty state: 0 archived projects */}
        {!isLoading && archivedProjects.length === 0 && (
          <ArchivedEmptyState />
        )}

        {/* Empty state: Search/Filter matched 0 */}
        {!isLoading && archivedProjects.length > 0 && filteredProjects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-28 text-center select-none animate-in fade-in duration-300">
            <div className="relative mb-3 flex items-center justify-center">
              <div className="absolute inset-0 size-16 rounded-full bg-foreground/[0.03] blur-xl -z-10" />
              <Archive className="size-10 stroke-[1.25] text-muted-foreground/35" />
            </div>
            <div className="space-y-1 max-w-sm px-4 mb-3">
              <h3 className="text-sm font-medium text-foreground tracking-tight">No matching archived projects</h3>
              <p className="text-xs text-muted-foreground/80 leading-relaxed">
                No archived projects matched your search or filter criteria.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setPopoverFilter({
                  myProjects: false,
                  access: [],
                  leads: [],
                  members: [],
                  createdDate: 'all',
                });
              }}
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer h-7 px-2.5"
            >
              Clear filters
            </Button>
          </div>
        )}
      </div>

      {/* Permanent Delete Confirmation Dialog */}
      <DeletePermanentModal
        project={deleteConfirmProject}
        onClose={() => setDeleteConfirmProject(null)}
        onConfirm={handleDeletePermanent}
        isDeleting={deleteProjectMutation.isPending}
      />
    </div>
  );
}

export default ArchivePage;
