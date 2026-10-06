'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, ChevronRight, Folder, Search } from 'lucide-react';
import { cn } from "@/shared/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui";
import type { TreeNode, CollectionActionHandlers } from './sidebar.types';
import type { Collection, LibraryScope, ProjectRole } from '../../types';
import type { SavedSearch } from '../../types/saved-searches.types';
import { CollectionTree } from './CollectionTree';
import { SidebarNavItem } from './SidebarNavItem';
import { SavedSearchContextMenu } from './SavedSearchContextMenu';
import { parseEmojiPrefix } from '../../utils';
import { getLibraryPermissions } from '../../domain';

interface ProjectLibrariesSectionProps extends CollectionActionHandlers {
  projects: any[];
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
  renamingSavedSearchId?: string | null;
  renameSavedSearchValue?: string;
}

/**
 * Safely resolves the current user's role across the 4 canonical project roles:
 * 'owner' | 'coordinator' | 'contributor' | 'reviewer'.
 * The owner is matched when owner = userId (project.userId / createdById / ownerId).
 */
export function resolveProjectRole(
  project: any,
  currentUserId?: string,
): ProjectRole {
  if (!currentUserId || !project) return 'reviewer';

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
  }

  // 4. Default to least privilege
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
              className="absolute right-2 z-20 flex size-6 shrink-0 items-center justify-center rounded-md text-foreground hover:bg-foreground/10 active:bg-foreground/20 transition-colors duration-150 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
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
            className="text-11 font-normal px-2 py-0.5 rounded-md border border-border bg-popover text-foreground shadow-md"
          >
            {isProjectsExpanded ? 'Collapse' : 'Expand'}
          </TooltipContent>
        </Tooltip>
      </div>

      {isProjectsExpanded && (
        <div className="flex flex-col gap-1 w-full">
          {projects.length === 0 ? (
            <div className="pl-6 pr-2.5 py-1.5 text-11 text-foreground/75 italic select-none">
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
                <div key={project.id} className="flex flex-col gap-1 w-full">
                  <button
                    type="button"
                    onClick={() => {
                      const role = resolveProjectRole(project, currentUserId);
                      onSelectProject({
                        type: 'project',
                        id: project.id,
                        projectId: project.id,
                        name: project.name,
                        role,
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
                            <div className="px-6 py-1 text-11 font-medium text-foreground flex items-center justify-between">
                              <span>Saved Searches</span>
                            </div>
                            {savedSearches.map((ss) => {
                              const isSSActive =
                                currentFilter === 'saved-search' && currentSavedSearchId === ss.id;
                              const isRenaming = renamingSavedSearchId === ss.id;
                              const { label: cleanName } = parseEmojiPrefix(ss.name);

                              if (isRenaming) {
                                return (
                                  <div
                                    key={ss.id}
                                    className="relative z-10 flex h-8 w-full items-center pr-2 min-w-0 gap-2.5 pl-6"
                                  >
                                    <Search className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
                                    <input
                                      autoFocus
                                      value={renameSavedSearchValue}
                                      onChange={(e) => onRenameSavedSearchValueChange?.(e.target.value)}
                                      onBlur={() => onSubmitRenameSavedSearch?.(ss.id)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') onSubmitRenameSavedSearch?.(ss.id);
                                        if (e.key === 'Escape') onSubmitRenameSavedSearch?.('__cancel__');
                                      }}
                                      className="h-7 w-full min-w-0 rounded-md border border-border bg-background px-2 text-13 font-normal focus:outline-none focus:ring-1 focus:ring-ring shadow-none text-foreground"
                                    />
                                  </div>
                                );
                              }

                              return (
                                <div key={ss.id} className="group/item relative flex items-center w-full has-[[data-state=open]]:bg-muted rounded-md">
                                  <div className="flex-1 min-w-0">
                                    <SidebarNavItem
                                      href={`${basePath}?filter=saved-search&savedSearchId=${ss.id}`}
                                      icon={Search}
                                      label={cleanName}
                                      isActive={isSSActive}
                                      navId={navId}
                                      onClick={onLinkClick}
                                    />
                                  </div>
                                  <div className="absolute right-1.5 z-20">
                                    <SavedSearchContextMenu
                                      savedSearch={ss as SavedSearch}
                                      onEdit={onEditSavedSearch || (() => {})}
                                      onRename={(id, name) => onStartRenameSavedSearch?.(id, name)}
                                      onDuplicate={onDuplicateSavedSearch || (() => {})}
                                      onDelete={onDeleteSavedSearch || (() => {})}
                                    />
                                  </div>
                                </div>
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
