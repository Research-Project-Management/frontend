'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, ChevronRight, Folder, Search } from 'lucide-react';
import { cn } from "@/shared/lib/utils";
import type { TreeNode, CollectionActionHandlers } from '../types';
import type { Collection } from '@/features/library/types/library.types';
import { CollectionTree } from './CollectionTree';
import { SidebarNavItem } from './SidebarNavItem';

interface ProjectLibrariesSectionProps extends CollectionActionHandlers {
  projects: any[];
  activeScope: any;
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
  onSelectProject: (scope: any) => void;
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
    <div className="mt-1 flex flex-col gap-1 w-full">
      <div className="relative group/root flex items-center w-full">
        <button
          type="button"
          onClick={() => setIsProjectsExpanded((v) => !v)}
          className={cn(
            "group/item relative flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-13 leading-5 transition-colors outline-none select-none pr-8 cursor-pointer text-left",
            activeScope.type === 'project'
              ? "bg-muted text-foreground font-medium"
              : "text-foreground hover:bg-muted font-normal"
          )}
        >
          <Users className="relative z-10 size-4 shrink-0 text-foreground" strokeWidth={1.5} />
          <span className="relative z-10 min-w-0 truncate flex-1 tracking-tight">
            Project Libraries
          </span>
        </button>

        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsProjectsExpanded((v) => !v);
          }}
          aria-label={isProjectsExpanded ? 'Collapse Project Libraries' : 'Expand Project Libraries'}
          className="absolute right-2 z-20 flex size-5 shrink-0 items-center justify-center rounded-sm text-foreground hover:bg-muted transition-colors cursor-pointer"
        >
          <ChevronRight
            className={cn(
              'size-3.5 text-foreground transition-transform duration-150 shrink-0',
              isProjectsExpanded && 'rotate-90'
            )}
          />
        </button>
      </div>

      {isProjectsExpanded && (
        <div className="flex flex-col gap-0.5 w-full">
          {projects.length === 0 ? (
            <div className="pl-6 pr-2.5 py-1.5 text-11 text-muted-foreground/70 italic select-none">
              No project libraries
            </div>
          ) : (
            projects.map((project) => {
              const isProjectActive =
                activeScope.type === 'project' && activeScope.id === project.id;
              return (
                <div key={project.id} className="flex flex-col gap-0.5 w-full">
                  <button
                    type="button"
                    onClick={() => {
                      const member = (project.members || []).find(
                        (m: any) => m.userId === currentUserId || m.user?.id === currentUserId,
                      );
                      const role =
                        project.createdById === currentUserId
                          ? 'owner'
                          : (member?.role as any) || 'contributor';
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
                      <div className="flex flex-col gap-0.5 w-full pl-2">
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
                          <div className="my-1 flex flex-col gap-0.5 border-t border-border/40 pt-1">
                            <div className="px-6 py-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                              <span>Saved Searches</span>
                              <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 rounded">
                                {savedSearches.length}
                              </span>
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
