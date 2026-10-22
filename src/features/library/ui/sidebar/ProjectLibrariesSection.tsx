'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, ChevronRight, Folder, Files } from 'lucide-react';
import { cn } from "@/shared/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import type { TreeNode, CollectionActionHandlers } from './sidebar.types';
import type { Collection, LibraryScope, ProjectRole } from '@/features/library/domain/types/library.types';
import type { SavedSearch } from '@/features/library/domain/types/saved-searches.types';
import { CollectionTree } from './CollectionTree';
import { SidebarNavItem } from './SidebarNavItem';
import { SavedSearchListSection } from './SavedSearchListSection';
import { getLibraryPermissions } from '@/features/library/domain/library-permissions.policy';

export interface ProjectLike {
  id: string;
  name?: string;
  role?: string;
  yourRole?: string;
  permissions?: Partial<import('@/features/library/domain/types/library.types').LibraryPermissions> | string[] | Record<string, unknown>;
  effectivePermissions?: string[];
  [key: string]: unknown;
}

interface ProjectLibrariesSectionProps extends CollectionActionHandlers {
  projects: ProjectLike[];
  activeScope: LibraryScope;
  currentUserId?: string;
  basePath: string;
  navId: string;
  projectTree: TreeNode[];
  projectCollections: Collection[];
  savedSearches?: SavedSearch[] | Array<{ id: string; name: string }>;
  currentSavedSearchId?: string | null;
  currentFilter?: string | null;
  activeId: string | string[] | null;
  isSearching: boolean;
  searchQuery: string;
  renamingId: string | null;
  renameValue: string;
  canManageCollections?: boolean;
  onSelectProject: (scope: LibraryScope) => void;
  onEditSavedSearch?: (savedSearch: SavedSearch) => void;
  onStartRenameSavedSearch?: (id: string, name: string) => void;
  onSubmitRenameSavedSearch?: (id: string) => void;
  onRenameSavedSearchValueChange?: (value: string) => void;
  onDuplicateSavedSearch?: (savedSearch: SavedSearch) => void;
  onDeleteSavedSearch?: (id: string) => void;
  pathname?: string;
  renamingSavedSearchId?: string | null;
  renameSavedSearchValue?: string;
}

/**
 * Reads the Backend-authoritative role ('yourRole' | 'role') provided on the project summary DTO.
 * Never guesses roles by inspecting ownerId/createdById/members[] on the client.
 */
export function resolveProjectRole(
  project: ProjectLike | null | undefined,
  _currentUserId?: string,
): ProjectRole {
  if (!project) return 'reviewer';

  const rawServerRole = project.yourRole || project.role;
  if (rawServerRole) {
    const norm = String(rawServerRole).trim().toLowerCase();
    if (norm === 'owner') return 'owner';
    if (norm === 'coordinator') return 'coordinator';
    if (norm === 'contributor') return 'contributor';
    if (norm === 'reviewer') return 'reviewer';
  }

  return 'reviewer';
}

export function ProjectLibrariesSection({
  projects,
  activeScope,
  currentUserId,
  basePath,
  navId,
  projectTree,
  projectCollections,
  savedSearches,
  currentSavedSearchId,
  currentFilter,
  activeId,
  isSearching,
  searchQuery,
  renamingId,
  renameValue,
  canManageCollections: propCanManageCollections,
  onSelectProject,
  onStartRename,
  onSubmitRename,
  onRenameValueChange,
  onDelete,
  onDeleteWithItems,
  onMove,
  onCopy,
  onCreateSub,
  onExportBibtex,
  onExportBundle,
  onLinkClick,
  onDropItems,
  onEditSavedSearch,
  onStartRenameSavedSearch,
  onSubmitRenameSavedSearch,
  onRenameSavedSearchValueChange,
  onDuplicateSavedSearch,
  onDeleteSavedSearch,
  renamingSavedSearchId,
  renameSavedSearchValue = '',
  pathname = '',
}: ProjectLibrariesSectionProps) {
  const [isProjectsExpanded, setIsProjectsExpanded] = useState(true);

  return (
    <div className="mt-1.5 flex flex-col gap-0.5 w-full">
      <div className="relative group/root flex items-center w-full">
        <button
          type="button"
          onClick={() => setIsProjectsExpanded((v) => !v)}
          className={cn(
            "group/item relative flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-13 leading-5 transition-colors outline-none select-none pr-8 cursor-pointer text-left",
            activeScope.type === 'project'
              ? "bg-muted text-foreground font-medium"
              : "text-foreground hover:bg-muted group-hover/root:bg-muted font-normal"
          )}
        >
          <Users className="relative z-10 size-4 shrink-0 text-foreground" strokeWidth={1.5} />
          <span className="relative z-10 min-w-0 truncate flex-1 tracking-tight">
            Project Libraries
          </span>
        </button>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsProjectsExpanded((v) => !v);
              }}
              aria-label={isProjectsExpanded ? 'Collapse Project Libraries' : 'Expand Project Libraries'}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 z-20 flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground border border-transparent hover:border-border/50 hover:bg-background hover:shadow-2xs active:scale-95 transition-all duration-150 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <ChevronRight
                className={cn(
                  'size-3.5 transition-transform duration-150 shrink-0',
                  isProjectsExpanded && 'rotate-90'
                )}
                strokeWidth={1.5}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            align="start"
            sideOffset={6}
            alignOffset={2}
          >
            {isProjectsExpanded ? 'Collapse' : 'Expand'}
          </TooltipContent>
        </Tooltip>
      </div>

      {isProjectsExpanded && (
        <div className="flex flex-col gap-0.5 w-full">
          {projects.length === 0 ? (
            <div className="pl-6 pr-2.5 py-1.5 text-11 text-muted-foreground italic select-none">
              No project libraries
            </div>
          ) : (
            projects.map((project) => {
              const isProjectActive =
                activeScope.type === 'project' && activeScope.id === project.id;
              const projectCanManageCollections =
                propCanManageCollections !== undefined
                  ? propCanManageCollections
                  : isProjectActive && getLibraryPermissions(activeScope).canManageCollections;

              return (
                <div key={project.id} className="flex flex-col gap-0.5 w-full">
                  <button
                    type="button"
                    onClick={() => {
                      const role = resolveProjectRole(project, currentUserId);
                      onSelectProject({
                        type: 'project',
                        id: project.id,
                        projectId: project.id,
                        name: project.name || '',
                        role,
                        ...(project.permissions ? { permissions: project.permissions } : {}),
                        ...(project.effectivePermissions
                          ? { effectivePermissions: project.effectivePermissions }
                          : {}),
                      });
                    }}
                    className={cn(
                      "group/item relative flex h-8 w-full items-center gap-2.5 rounded-md pr-2.5 pl-6 text-13 leading-5 transition-colors outline-none select-none text-left cursor-pointer",
                      isProjectActive
                        ? "bg-muted text-foreground font-medium"
                        : "text-foreground hover:bg-muted group-hover/root:bg-muted has-[[data-state=open]]:bg-muted font-normal",
                    )}
                  >
                    {isProjectActive && (
                      <motion.div
                        layoutId={`library-project-active-${navId}`}
                        className="absolute inset-0 rounded-md bg-muted"
                        initial={false}
                        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                      />
                    )}
                    <Folder className="relative z-10 size-4 shrink-0 text-foreground" strokeWidth={1.5} />
                    <span className="relative z-10 min-w-0 truncate flex-1 tracking-tight">
                      {project.name}
                    </span>
                  </button>

                  {/* Project Contents (Rendered when this project is active) */}
                  {isProjectActive && (
                    <div className="flex flex-col gap-0.5 w-full">
                      {projectTree.length > 0 && (
                        <CollectionTree
                          tree={projectTree}
                          allCollections={projectCollections}
                          basePath={basePath}
                          activeId={activeId}
                          navId={navId}
                          renamingId={renamingId}
                          renameValue={renameValue}
                          isSearching={isSearching}
                          searchQuery={searchQuery}
                          canManageCollections={projectCanManageCollections}
                          onStartRename={onStartRename}
                          onSubmitRename={onSubmitRename}
                          onRenameValueChange={onRenameValueChange}
                          onDelete={onDelete}
                          onDeleteWithItems={onDeleteWithItems}
                          onMove={onMove}
                          onCopy={onCopy}
                          onCreateSub={onCreateSub}
                          onExportBibtex={onExportBibtex}
                          onExportBundle={onExportBundle}
                          onLinkClick={onLinkClick}
                          onDropItems={onDropItems}
                        />
                      )}

                      <SavedSearchListSection
                        savedSearches={savedSearches as SavedSearch[] | undefined}
                        basePath={basePath}
                        navId={navId}
                        currentFilter={currentFilter ?? null}
                        currentSavedSearchId={currentSavedSearchId}
                        isActiveScope={isProjectActive}
                        onItemClick={onLinkClick}
                        onEditSavedSearch={onEditSavedSearch}
                        onStartRenameSavedSearch={onStartRenameSavedSearch}
                        onSubmitRenameSavedSearch={onSubmitRenameSavedSearch}
                        onRenameSavedSearchValueChange={onRenameSavedSearchValueChange}
                        onDuplicateSavedSearch={onDuplicateSavedSearch}
                        onDeleteSavedSearch={onDeleteSavedSearch}
                        renamingSavedSearchId={renamingSavedSearchId}
                        renameSavedSearchValue={renameSavedSearchValue}
                      />

                      {/* Project Duplicate Items Nav Item */}
                      <div className="flex flex-col gap-0.5 w-full">
                        <SidebarNavItem
                          href={`${basePath}/duplicates`}
                          icon={Files}
                          label="Duplicate Items"
                          isActive={pathname === `${basePath}/duplicates` || (pathname === basePath && currentFilter === 'duplicates')}
                          navId={navId}
                          onClick={onLinkClick}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
