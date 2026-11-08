'use client';

import React, { useState, useMemo } from 'react';
import { Archive, Search } from 'lucide-react';
import { WorkspaceCardGridSkeleton } from '@/shared/components/layout/WorkspaceSkeleton';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';
import {
  useProjects,
  useRestoreProject,
  useDeleteProject,
} from '../hooks/use-project';
import {
  filterArchivedProjects,
  searchArchivedProjects,
} from '../utils/archive-page.util';
import { ArchiveCard } from '../components/archived/ArchiveCard';
import { DeletePermanentModal } from '../components/archived/DeletePermanentModal';
import { ArchivedEmptyState } from '../components/archived/ArchivedEmptyState';
import type { Project } from '../types/project.types';

export function ArchivePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmProject, setDeleteConfirmProject] =
    useState<Project | null>(null);

  const {
    projects: rawProjects = [],
    isLoading: isProjectsLoading,
    isError: isProjectsError,
    error: projectsError,
  } = useProjects();

  const restoreProjectMutation = useRestoreProject();
  const deleteProjectMutation = useDeleteProject();
  const { mutate: restoreProject } = restoreProjectMutation;
  const { mutate: deleteProject } = deleteProjectMutation;

  const archivedProjects = useMemo(
    () => filterArchivedProjects(rawProjects),
    [rawProjects],
  );

  const filteredArchivedProjects = useMemo(
    () => searchArchivedProjects(archivedProjects, searchQuery),
    [archivedProjects, searchQuery],
  );

  const handleRestoreProject = React.useCallback(
    (projectId: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      restoreProject({ projectId });
    },
    [restoreProject],
  );

  const handleOpenDeletePermanent = React.useCallback(
    (p: Project, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDeleteConfirmProject(p);
    },
    [],
  );

  const handleDeletePermanent = React.useCallback(() => {
    if (!deleteConfirmProject?.id) return;
    deleteProject(
      { projectId: deleteConfirmProject.id },
      { onSettled: () => setDeleteConfirmProject(null) },
    );
  }, [deleteConfirmProject?.id, deleteProject]);

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden select-none">
      {/* ── Top Header (Matching Your Work pattern) ── */}
      <header
        className="flex items-center justify-between px-6 h-11 border-b border-border bg-background sticky top-0 z-20 shrink-0 select-none min-w-0"
        style={{ paddingLeft: 'max(1.5rem, var(--header-offset, 0px))' }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Archive className="size-4 text-foreground shrink-0" />
          <h1 className="text-13 font-semibold text-foreground tracking-tight">
            Archived projects
          </h1>
          {archivedProjects.length > 0 && (
            <span className="text-11 px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium leading-none tabular-nums">
              {archivedProjects.length}
            </span>
          )}
        </div>

        {/* Instant Search Bar */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative flex items-center">
            <Search className="size-3.5 text-muted-foreground absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search archived projects..."
              className="h-8 w-44 sm:w-56 pl-8 pr-2.5 rounded-md border border-border bg-background text-12 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
            />
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8">
        {isProjectsLoading ? (
          <WorkspaceCardGridSkeleton variant="projects" count={4} />
        ) : isProjectsError ? (
          <div className="h-full min-h-[340px] flex items-center justify-center">
            <PlaneErrorState
              title="Failed to load archived projects"
              description="Could not retrieve the list of archived projects from the server."
              error={projectsError as Error}
            />
          </div>
        ) : filteredArchivedProjects.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredArchivedProjects.map((project) => (
              <ArchiveCard
                key={project.id}
                project={project}
                onRestore={handleRestoreProject}
                onDeletePermanent={handleOpenDeletePermanent}
                isRestoring={restoreProjectMutation.isPending}
              />
            ))}
          </div>
        ) : (
          <ArchivedEmptyState />
        )}
      </main>

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
