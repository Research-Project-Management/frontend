'use client';

import { useId, useState, useMemo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Library, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

import { cn } from "@/shared/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import {
  useCollections,
  useCollectionsQuery,
  useMoveCollectionItemsMutation,
  useAssignCollectionItemsMutation,
} from '@/features/library/sdk/queries/collections.queries';
import { useSavedSearches } from '@/features/library/sdk/queries/saved-searches-relations.queries';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import { useLibraryPermissions } from '@/features/library/core/coordinator/permissions.coordinator';
import { useLibraryProjectContext } from '@/features/library/core/adapters/project-context.adapter';

import type { SavedSearch } from '@/features/library/domain/types/saved-searches.types';

import { buildTree, filterCollections } from '@/features/library/domain/collection-tree.domain';
import { usePanelResize } from '@/features/library/ui/hooks/usePanelResize';
import { useCollectionCoordinator } from '@/features/library/core/coordinator/collection.coordinator';
import { SidebarHeader } from './SidebarHeader';
import { SidebarResizer } from './SidebarResizer';
import { CollectionTree } from './CollectionTree';
import { SidebarSystemNav } from './SidebarSystemNav';
import { FeedsListSection } from './FeedsListSection';
import { ProjectLibrariesSection, resolveProjectRole, type ProjectLike } from './ProjectLibrariesSection';

/**
 * LibrarySidebar Zone
 * Manages the collapsible, resizable left navigation pane (collections, tags, scopes).
 */
export function LibrarySidebar() {
  const { collectionId: activeId } = useParams() as {
    collectionId?: string;
  };
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = useId();

  const activeScope = useLibraryUIStore((s) => s.activeScope);
  const setActiveScope = useLibraryUIStore((s) => s.setActiveScope);
  const isSidebarOpen = useLibraryUIStore((s) => s.isSidebarOpen);
  const setSidebarOpen = useLibraryUIStore((s) => s.setSidebarOpen);
  const sidebarWidth = useLibraryUIStore((s) => s.sidebarWidth);
  const setSidebarWidth = useLibraryUIStore((s) => s.setSidebarWidth);
  const toggleSidebar = useLibraryUIStore((s) => s.toggleSidebar);
  const openModal = useLibraryUIStore((s) => s.openModal);
  const isInProjectContext = activeScope.type === 'project' && Boolean(activeScope.id);
  const projectId = isInProjectContext ? activeScope.id : '';
  const effectiveScopeId = isInProjectContext ? activeScope.id : 'user';
  const moveMutation = useMoveCollectionItemsMutation(effectiveScopeId);
  const assignMutation = useAssignCollectionItemsMutation(effectiveScopeId);

  const userCollectionsQuery = useCollectionsQuery('user');
  const projectCollectionsQuery = useCollectionsQuery(projectId, {
    enabled: isInProjectContext,
  });
  const collectionService = useCollections({
    scopeId: effectiveScopeId,
    enabled: false,
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, [setSidebarOpen]);

  const [isLibraryExpanded, setIsLibraryExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [renamingSavedSearchId, setRenamingSavedSearchId] = useState<string | null>(null);
  const [renameSavedSearchValue, setRenameSavedSearchValue] = useState('');

  const { isDragging, handleMouseDown } = usePanelResize({
    width: sidebarWidth,
    setWidth: setSidebarWidth,
    direction: 'right',
    minWidth: 200,
    maxWidth: 400,
  });

  const basePath = '/library';
  const currentFilter = searchParams.get('filter');
  const currentSavedSearchId = searchParams.get('savedSearchId');
  const currentFeedId = searchParams.get('feedId');

  const { projects, currentUserId } = useLibraryProjectContext();

  const isUserScope = activeScope.type === 'user';
  const isLibraryActive = isUserScope && pathname === basePath && !currentFilter && !activeId;

  const { canManageCollections } = useLibraryPermissions();

  // Synchronize active project role and permissions with server-provided project list
  useEffect(() => {
    if (activeScope.type === 'project' && projects && projects.length > 0) {
      const currentProject = projects.find((p: ProjectLike) => p.id === activeScope.id);
      if (currentProject) {
        const accurateRole = resolveProjectRole(currentProject, currentUserId);
        const serverPerms = currentProject.permissions;
        const serverEffective = Array.isArray(currentProject.effectivePermissions)
          ? (currentProject.effectivePermissions as string[])
          : undefined;
        if (
          accurateRole !== activeScope.role ||
          serverPerms !== activeScope.permissions ||
          serverEffective !== activeScope.effectivePermissions
        ) {
          setActiveScope({
            ...activeScope,
            role: accurateRole,
            ...(serverPerms ? { permissions: serverPerms } : {}),
            ...(serverEffective ? { effectivePermissions: serverEffective } : {}),
          });
        }
      }
    }
  }, [activeScope, currentUserId, projects, setActiveScope]);

  const {
    savedSearches: userSavedSearches,
    createSavedSearch: createUserSavedSearch,
    updateSavedSearch: updateUserSavedSearch,
    deleteSavedSearch: deleteUserSavedSearch,
  } = useSavedSearches('user');

  const {
    savedSearches: projectSavedSearches,
    createSavedSearch: createProjectSavedSearch,
    updateSavedSearch: updateProjectSavedSearch,
    deleteSavedSearch: deleteProjectSavedSearch,
  } = useSavedSearches(projectId, { enabled: isInProjectContext });

  const handleEditSavedSearch = (ss: SavedSearch) => {
    openModal('SAVED_SEARCH', { savedSearch: ss });
  };

  const handleDuplicateSavedSearch = async (ss: SavedSearch) => {
    const isProjectSearch =
      Boolean(ss.projectId) ||
      (activeScope.type === 'project' && ss.scopeId === activeScope.id);
    const targetCreate =
      isProjectSearch && projectId ? createProjectSavedSearch : createUserSavedSearch;
    await targetCreate({
      name: `${ss.name} (Copy)`,
      conjunction: ss.conjunction || 'AND',
      conditions: ss.conditions,
      sortBy: ss.sortBy,
      sortOrder: ss.sortOrder,
      scopeOptions: ss.scopeOptions,
    });
  };

  const handleDeleteSavedSearch = async (id: string) => {
    const inUser = userSavedSearches.some((s) => s.id === id);
    if (inUser) {
      await deleteUserSavedSearch(id);
    } else {
      await deleteProjectSavedSearch(id);
    }
  };

  const handleStartRenameSavedSearch = (id: string, name: string) => {
    setRenamingSavedSearchId(id);
    setRenameSavedSearchValue(name);
  };

  const handleSubmitRenameSavedSearch = async (id: string) => {
    if (id !== '__cancel__') {
      const trimmed = renameSavedSearchValue.trim();
      if (trimmed) {
        const inUser = userSavedSearches.some((s) => s.id === id);
        if (inUser) {
          await updateUserSavedSearch({
            id,
            data: { name: trimmed },
          });
        } else {
          await updateProjectSavedSearch({
            id,
            data: { name: trimmed },
          });
        }
      }
    }
    setRenamingSavedSearchId(null);
    setRenameSavedSearchValue('');
  };

  const userCollections = useMemo(
    () => userCollectionsQuery.data ?? [],
    [userCollectionsQuery.data],
  );

  const projectCollections = useMemo(
    () => (isInProjectContext ? projectCollectionsQuery.data ?? [] : []),
    [isInProjectContext, projectCollectionsQuery.data],
  );

  const collections = useMemo(
    () => (activeScope.type === 'project' ? projectCollections : userCollections),
    [activeScope.type, projectCollections, userCollections],
  );

  const handleBatchMoveItems = useCallback(
    async (
      ids: string[],
      targetCollectionId: string | null,
      options?: { copy?: boolean; move?: boolean },
    ) => {
      if (!ids.length) return;
      let targetScopeId = effectiveScopeId;
      if (targetCollectionId) {
        const isUserCol = userCollections.some((c) => c.id === targetCollectionId);
        const isProjCol = projectCollections.some((c) => c.id === targetCollectionId);
        if (isUserCol) {
          targetScopeId = 'user';
        } else if (isProjCol && projectId) {
          targetScopeId = projectId;
        }
      }

      if (options?.copy && targetCollectionId) {
        const toastId = toast.loading(`Adding ${ids.length} item(s) to collection...`, {
          id: 'batch-move',
        });
        try {
          await assignMutation.mutateAsync({
            collectionId: targetCollectionId,
            itemIds: ids,
          });
          toast.success('Documents added to collection', {
            description: `Added ${ids.length} item(s) while keeping existing collections.`,
            id: toastId,
          });
        } catch (err: unknown) {
          toast.error('Failed to add items to collection', {
            description:
              err instanceof Error
                ? err.message
                : 'Could not add selected documents.',
            id: toastId,
          });
        }
        return;
      }

      const toastId = toast.loading(`Moving ${ids.length} item(s)...`, {
        id: 'batch-move',
      });
      try {
        await moveMutation.mutateAsync({
          targetCollectionId,
          itemIds: ids,
          scopeId: targetScopeId,
        });
        toast.success('Documents moved', {
          description: `Moved ${ids.length} item(s) to target collection.`,
          id: toastId,
        });
      } catch (err: unknown) {
        toast.error('Failed to move items', {
          description:
            err instanceof Error
              ? err.message
              : 'Could not move selected documents.',
          id: toastId,
        });
      }
    },
    [assignMutation, effectiveScopeId, moveMutation, projectCollections, projectId, userCollections],
  );

  const userTree = useMemo(
    () => buildTree(filterCollections(userCollections, searchQuery)),
    [userCollections, searchQuery],
  );

  const projectTree = useMemo(
    () => buildTree(filterCollections(projectCollections, searchQuery)),
    [projectCollections, searchQuery],
  );

  const allCollectionsByScope = useMemo(
    () => ({
      user: userCollections,
      project: projectCollections,
      projectId,
    }),
    [userCollections, projectCollections, projectId],
  );

  const { rename, handlers } = useCollectionCoordinator({
    collectionService,
    effectiveScopeId,
    collections,
    allCollectionsByScope,
    activeCollectionId: activeId,
  });

  const [isMounted, setIsMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== 'undefined') {
      const mql = window.matchMedia('(max-width: 767px)');
      setIsMobile(mql.matches);
      const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }
  }, []);

  const handleMobileLinkClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  if (!isSidebarOpen) {
    return null;
  }

  const sidebarBody = (
    <>
      {/* Topbar Header matching the h-11 border-b of LibraryTopbar & Inspector */}
      <div className="h-11 px-2.5 flex items-center shrink-0">
        <SidebarHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          canManageCollections={canManageCollections}
          onOpenCreateRoot={handlers.openCreateRoot}
          onOpenCreateSavedSearch={() => openModal('SAVED_SEARCH')}
          onToggleCollapse={toggleSidebar}
        />
      </div>

      {/* Upper Area: Collections Tree, Views */}
      <div className="flex-1 min-h-0 flex flex-col p-2.5 pt-2.5 pb-1">
          {/* Navigation Links */}
            <nav
              aria-label="Library Navigation"
              className="flex-1 overflow-x-hidden overflow-y-auto flex flex-col gap-0.5 sidebar-scrollbar scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              {/* 1. My Library */}
              <div className="relative group/root flex items-center w-full">
                <Link
                  href={basePath}
                  onClick={() => {
                    setActiveScope({
                      type: 'user',
                      id: 'user',
                      name: 'Library',
                    });
                    handleMobileLinkClick();
                  }}
                  className={cn(
                    "group/item relative flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-13 leading-5 transition-colors outline-none select-none pr-8",
                    isLibraryActive
                      ? "bg-muted text-foreground font-medium"
                      : "text-foreground hover:bg-muted group-hover/root:bg-muted font-normal"
                  )}
                >
                  
                  <Library
                    className="relative z-10 size-4 shrink-0 text-foreground"
                    strokeWidth={1.5}
                  />
                  <span className={cn(
                    "relative z-10 min-w-0 truncate flex-1 tracking-tight text-foreground",
                    isLibraryActive ? "font-medium" : "font-normal"
                  )}>
                    My Library
                  </span>
                </Link>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsLibraryExpanded((v) => !v);
                      }}
                      aria-label={isLibraryExpanded ? 'Collapse My Library' : 'Expand My Library'}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 z-20 flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground border border-transparent hover:border-border/50 hover:bg-background cursor-pointer transition-colors duration-150 outline-none focus-visible:ring-1 focus-visible:ring-primary before:absolute before:-inset-2 md:before:hidden"
                    >
                      <ChevronRight
                        className={cn(
                          'size-3.5 transition-transform duration-150 shrink-0',
                          isLibraryExpanded && 'rotate-90'
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
                    {isLibraryExpanded ? 'Collapse' : 'Expand'}
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Sub-items directly nested under My Library */}
              {isLibraryExpanded && (
                <div className="flex flex-col gap-0.5 w-full">
                  <SidebarSystemNav
                    basePath={basePath}
                    pathname={pathname}
                    currentFilter={currentFilter}
                    isUserScope={isUserScope}
                    navId={id}
                    savedSearches={userSavedSearches}
                    currentSavedSearchId={currentSavedSearchId}
                    currentFeedId={currentFeedId}
                    onDropItems={handleBatchMoveItems}
                    onSelectUserScope={() => {
                      setActiveScope({
                        type: 'user',
                        id: 'user',
                        name: 'Library',
                        role: 'owner',
                      });
                      handleMobileLinkClick();
                    }}
                    onDeleteSavedSearch={handleDeleteSavedSearch}
                    onEditSavedSearch={handleEditSavedSearch}
                    onStartRenameSavedSearch={handleStartRenameSavedSearch}
                    onSubmitRenameSavedSearch={handleSubmitRenameSavedSearch}
                    onRenameSavedSearchValueChange={setRenameSavedSearchValue}
                    onDuplicateSavedSearch={handleDuplicateSavedSearch}
                    renamingSavedSearchId={renamingSavedSearchId}
                    renameSavedSearchValue={renameSavedSearchValue}
                  >
                    {/* User Collections Tree */}
                    <CollectionTree
                      tree={userTree}
                      allCollections={userCollections}
                      basePath={basePath}
                      activeId={isUserScope ? (activeId ?? null) : null}
                      navId={id}
                      renamingId={rename.renamingId}
                      renameValue={rename.renameValue}
                      isSearching={searchQuery.trim().length > 0}
                      searchQuery={searchQuery}
                      canManageCollections={true}
                      onStartRename={handlers.startRename}
                      onSubmitRename={handlers.submitRename}
                      onRenameValueChange={rename.setRenameValue}
                      onDelete={handlers.handleDelete}
                      onDeleteWithItems={handlers.handleDeleteWithItems}
                      onMove={handlers.handleMove}
                      onCopy={handlers.handleCopy}
                      onCreateSub={handlers.openCreateSub}
                      onExportBibtex={handlers.handleExportBibtex}
                      onExportBundle={handlers.handleExportBundle}
                      onLinkClick={() => {
                        if (!isUserScope) {
                          setActiveScope({
                            type: 'user',
                            id: 'user',
                            name: 'Library',
                            role: 'owner',
                          });
                        }
                        handleMobileLinkClick();
                      }}
                      onDropItems={handleBatchMoveItems}
                    />
                  </SidebarSystemNav>
                </div>
              )}

              {/* 2. Feeds (Root Level) */}
              <FeedsListSection
                basePath={basePath}
                navId={id}
                currentFilter={currentFilter}
                currentFeedId={currentFeedId}
                isActiveScope={true}
                onItemClick={handleMobileLinkClick}
              />

              {/* 3. Project Libraries (Collaborative Research Groups) */}
              <ProjectLibrariesSection
                projects={projects}
                activeScope={activeScope}
                currentUserId={currentUserId}
                basePath={basePath}
                navId={id}
                projectTree={projectTree}
                projectCollections={projectCollections}
                savedSearches={projectSavedSearches}
                currentSavedSearchId={currentSavedSearchId}
                currentFilter={currentFilter}
                activeId={!isUserScope ? (activeId ?? null) : null}
                isSearching={searchQuery.trim().length > 0}
                searchQuery={searchQuery}
                renamingId={rename.renamingId}
                renameValue={rename.renameValue}
                canManageCollections={canManageCollections}
                onSelectProject={(scope) => {
                  setActiveScope(scope);
                  router.push(basePath);
                  handleMobileLinkClick();
                }}
                onStartRename={handlers.startRename}
                onSubmitRename={handlers.submitRename}
                onRenameValueChange={rename.setRenameValue}
                onDelete={handlers.handleDelete}
                onDeleteWithItems={handlers.handleDeleteWithItems}
                onMove={handlers.handleMove}
                onCopy={handlers.handleCopy}
                onCreateSub={handlers.openCreateSub}
                onExportBibtex={handlers.handleExportBibtex}
                onExportBundle={handlers.handleExportBundle}
                onLinkClick={handleMobileLinkClick}
                onDropItems={handleBatchMoveItems}
                onEditSavedSearch={handleEditSavedSearch}
                onStartRenameSavedSearch={handleStartRenameSavedSearch}
                onSubmitRenameSavedSearch={handleSubmitRenameSavedSearch}
                onRenameSavedSearchValueChange={setRenameSavedSearchValue}
                onDuplicateSavedSearch={handleDuplicateSavedSearch}
                onDeleteSavedSearch={handleDeleteSavedSearch}
                renamingSavedSearchId={renamingSavedSearchId}
                renameSavedSearchValue={renameSavedSearchValue}
                pathname={pathname}
              />
            </nav>
        </div>

        {/* Drag Handle for Resizing */}
        <SidebarResizer
          width={sidebarWidth}
          setWidth={setSidebarWidth}
          isDragging={isDragging}
          onMouseDown={handleMouseDown}
        />
      </>
    );

    const mobileDrawer =
      isMobile && isMounted && typeof document !== 'undefined'
        ? createPortal(
            <div className="md:hidden">
              {/* Mobile Backdrop Overlay */}
              <div
                className="fixed inset-0 z-40 bg-black/50"
                onClick={() => setSidebarOpen(false)}
                aria-hidden="true"
              />
              <aside
                aria-label="Library navigation and collections"
                style={{
                  width: `${sidebarWidth}px`,
                  minWidth: '200px',
                  maxWidth: '400px',
                }}
                className="fixed inset-y-0 left-0 z-50 h-full border-r border-border bg-background flex flex-col select-none shrink-0 shadow-raised-200"
              >
                {sidebarBody}
              </aside>
            </div>,
            document.body,
          )
        : null;

    return (
      <>
        {mobileDrawer}
        {!isMobile && (
          <aside
            aria-label="Library navigation and collections"
            style={{
              width: `${sidebarWidth}px`,
              minWidth: '200px',
              maxWidth: '400px',
            }}
            className="relative z-20 h-full border-r border-border bg-transparent flex flex-col select-none shrink-0"
          >
            {sidebarBody}
          </aside>
        )}
      </>
    );
  }

export { LibrarySidebar as Sidebar };
export default LibrarySidebar;



