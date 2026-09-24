'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, ChevronRight, Folder, Search } from 'lucide-react';
import { cn } from "@/shared/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui";
import type { TreeNode, CollectionActionHandlers } from './sidebar.types';
import type { Collection, LibraryScope } from '../../types';
import { CollectionTree } from './CollectionTree';
import { SidebarNavItem } from './SidebarNavItem';

interface ProjectLibrariesSectionProps extends CollectionActionHandlers {
  projects: any[];
  activeScope: LibraryScope;
  currentUserId?: string;
  basePath: string;
  navId: string;
  projectTree: TreeNode[];
  projectCollections: Collection[];
  savedSearches?: Array<{ id: string; name: string }>;
  currentSavedSearchId?: string | null;
  currentFilter?: string | null;
  activeId: string | string[] | null;
  isSearching: boolean;
  searchQuery: string;
  renamingId: string | null;
  renameValue: string;
  canManageCollections?: boolean;
  onSelectProject: (scope: LibraryScope) => void;
}

/**
 * Safely resolves the current user's role across the 4 standard roles:
 * 'owner' | 'contributor' | 'commenter' | 'viewer'.
 * The owner is matched when owner = userId (project.userId / createdById / ownerId).
 */
export function resolveProjectRole(
  project: any,
  currentUserId?: string,
): 'owner' | 'coordinator' | 'contributor' | 'reviewer' | 'commenter' | 'viewer' {
  if (!currentUserId || !project) return 'viewer';

  // 1. Owner = userId check
  const isOwner =
    project.userId === currentUserId ||
    project.createdById === currentUserId ||
    project.ownerId === currentUserId ||
    project.createdBy?.id === currentUserId;

  if (isOwner) {
    return 'owner';
  }

  // 2. Direct server-provided yourRole check
  const rawYourRole = project.yourRole;
  if (rawYourRole) {
    const norm = String(rawYourRole).toLowerCase();
    if (norm === 'owner' || norm === 'admin') return 'owner';
    if (norm === 'coordinator') return 'coordinator';
    if (norm === 'contributor' || norm === 'member') return 'contributor';
    if (norm === 'reviewer') return 'reviewer';
    if (norm === 'commenter') return 'commenter';
    if (norm === 'viewer') return 'viewer';
  }

  // 3. Find matching member in project.members array
  const member = (project.members || []).find(
    (m: any) =>
      m.userId === currentUserId ||
      m.user?.id === currentUserId ||
      m.id === currentUserId,
  );

  if (member?.role) {
    const norm = String(member.role).toLowerCase();
    if (norm === 'owner' || norm === 'admin') return 'owner';
    if (norm === 'coordinator') return 'coordinator';
    if (norm === 'contributor' || norm === 'member') return 'contributor';
    if (norm === 'reviewer') return 'reviewer';
    if (norm === 'commenter') return 'commenter';
    if (norm === 'viewer') return 'viewer';
  }

  // 4. Default to least privilege
  return 'viewer';
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
}: ProjectLibrariesSectionProps) {
  const [isProjectsExpanded, setIsProjectsExpanded] = useState(true);

  return (
    <div className="flex flex-col gap-1 w-full">
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

        <Tooltip delayDuration={700}>
          <TooltipTrigger asChild>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsProjectsExpanded((v) => !v);
              }}
              aria-label={isProjectsExpanded ? 'Collapse Project Libraries' : 'Expand Project Libraries'}
              className="absolute right-2 z-20 flex size-6 shrink-0 items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <ChevronRight
                className={cn(
                  'size-3.5 text-foreground transition-transform duration-150 shrink-0',
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
            className="text-11 font-normal px-2 py-0.5 rounded-md border border-border bg-popover text-foreground shadow-sm"
          >
            {isProjectsExpanded ? 'Collapse' : 'Expand'}
          </TooltipContent>
        </Tooltip>
      </div>

      {isProjectsExpanded && (
        <div className="flex flex-col gap-1 w-full">
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
                  : isProjectActive &&
                    (activeScope.role === 'owner' || activeScope.role === 'coordinator' || activeScope.role === 'contributor');

              return (
                <div key={project.id} className="flex flex-col gap-1 w-full">
                  <button
                    type="button"
                    onClick={() => {
                      const role = resolveProjectRole(project, currentUserId);
                      onSelectProject({
                        type: 'project',
                        id: project.id,
                        name: project.name,
                        role,
                      });
                    }}
                    className={cn(
                      "group/item relative flex h-8 w-full items-center gap-2.5 rounded-md pr-2.5 pl-6 text-13 leading-5 transition-colors outline-none select-none text-left cursor-pointer",
                      isProjectActive
                        ? "bg-muted text-foreground font-medium"
                        : "text-foreground hover:bg-muted font-normal",
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

                  {/* Project Collections Tree (Rendered when this project is active) */}
                  {isProjectActive &&
                    (projectTree.length > 0 || (savedSearches && savedSearches.length > 0)) && (
                      <div className="flex flex-col gap-1 w-full pl-2">
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

                        {savedSearches && savedSearches.length > 0 && (
                          <div className="my-1 flex flex-col gap-0.5 border-t border-border pt-1">
                            <div className="px-6 py-1 text-11 font-medium text-muted-foreground flex items-center justify-between">
                              <span>Saved Searches</span>
                            </div>
                            {savedSearches.map((ss) => {
                              const isSSActive =
                                currentFilter === 'saved-search' && currentSavedSearchId === ss.id;
                              return (
                                <SidebarNavItem
                                  key={ss.id}
                                  href={`${basePath}?filter=saved-search&savedSearchId=${ss.id}`}
                                  icon={Search}
                                  label={ss.name}
                                  isActive={isSSActive}
                                  navId={navId}
                                  onClick={onLinkClick}
                                />
                              );
                            })}
                          </div>
                        )}
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
