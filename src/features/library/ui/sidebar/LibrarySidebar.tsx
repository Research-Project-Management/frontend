'use client';

import { useId, useState, useMemo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Library, ChevronRight, FolderPlus, SlidersHorizontal, Download } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

import { cn } from "@/shared/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/shared/components/ui/context-menu';
import { executeExportScopeFormat } from '@/features/library/core/coordinator/citation.coordinator';
import {
  useCollections,
  useCollectionsQuery,
  useMoveCollectionItemsMutation,
  useAssignCollectionItemsMutation,
  useBatchDetachItemsMutation,
  useCollectionCoordinator,
} from '@/features/library/core/coordinator/collection.coordinator';
import {
  useSavedSearches,
  useTrash,
  useDeleteLibraryItemsMutation,
} from '@/features/library/core/coordinator/saved-search.coordinator';
import {
  useBatchRestoreItemsMutation,
  useLibraryCountsQuery,
  useDropToMyPublications,
} from '@/features/library/core/coordinator/item-action.coordinator';
import { useLibraryUIStore } from '@/features/library/core/store/ui.store';
import {
  useLibraryCommandStore,
  createMoveItemsCommand,
  createBatchAssignCommand,
  createTrashCommand,
} from '@/features/library/core/manager/command.manager';
import { useLibraryPermissions } from '@/features/library/core/coordinator/navigation.coordinator';
import { useLibraryProjectContext } from '@/features/library/core/adapters/project-context.adapter';
import { useWorkspaceContextStore } from '@/features/shell/store/workspace-context.store';

import type { SavedSearch } from '@/features/library/types/ingestion.types';

import { buildCollectionTree, filterCollections } from '@/features/library/domain/collection-tree';
import { usePanelResize } from '@/shared/hooks/use-panel-resize';
import { useIsMobile } from '@/shared/hooks/use-media-query';
import { CollectionTree } from './CollectionTree';
import { SidebarHeader, SidebarSystemNav, SidebarResizer } from './SidebarSystemNav';
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

  const activeSpace = useWorkspaceContextStore((s) => s.activeSpace);
  const isSidebarOpen = useLibraryUIStore((s) => s.isSidebarOpen);
  const setSidebarOpen = useLibraryUIStore((s) => s.setSidebarOpen);
  const sidebarWidth = useLibraryUIStore((s) => s.sidebarWidth);
  const setSidebarWidth = useLibraryUIStore((s) => s.setSidebarWidth);
  const toggleSidebar = useLibraryUIStore((s) => s.toggleSidebar);
  const openModal = useLibraryUIStore((s) => s.openModal);
  const isInProjectContext = activeSpace.type === 'project' && Boolean(activeSpace.projectId);
  const projectId = isInProjectContext ? activeSpace.projectId! : '';
  const effectiveSpaceId = isInProjectContext ? activeSpace.projectId! : 'user';
  const moveMutation = useMoveCollectionItemsMutation(effectiveSpaceId);
  const assignMutation = useAssignCollectionItemsMutation(effectiveSpaceId);
  const detachMutation = useBatchDetachItemsMutation(effectiveSpaceId);

  const [isLibraryExpanded, setIsLibraryExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [renamingSavedSearchId, setRenamingSavedSearchId] = useState<string | null>(null);
  const [renameSavedSearchValue, setRenameSavedSearchValue] = useState('');

  const userCollectionsQuery = useCollectionsQuery('user', {
    enabled: !isInProjectContext || isLibraryExpanded,
  });
  const projectCollectionsQuery = useCollectionsQuery(projectId, {
    enabled: isInProjectContext,
  });
  const collectionService = useCollections({
    spaceId: effectiveSpaceId,
    enabled: false,
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, [setSidebarOpen]);

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

  const isUserScope = !isInProjectContext;
  const isLibraryActive = pathname === basePath && !currentFilter && !activeId;

  const { canManageCollections } = useLibraryPermissions();

  const {
    savedSearches: userSavedSearches,
    createSavedSearch: createUserSavedSearch,
    updateSavedSearch: updateUserSavedSearch,
    deleteSavedSearch: deleteUserSavedSearch,
  } = useSavedSearches('user', {
    enabled: !isInProjectContext || isLibraryExpanded,
  });

  const {
    savedSearches: projectSavedSearches,
    createSavedSearch: createProjectSavedSearch,
    updateSavedSearch: updateProjectSavedSearch,
    deleteSavedSearch: deleteProjectSavedSearch,
  } = useSavedSearches(projectId, { enabled: isInProjectContext });

  const { trashItems, emptyTrash } = useTrash(effectiveSpaceId, {
    enabled: currentFilter === 'trash',
  });
  const { data: userCounts } = useLibraryCountsQuery(effectiveSpaceId);
  const effectiveTrashCount =
    currentFilter === 'trash' ? trashItems.length : (userCounts?.trash ?? trashItems.length);
  const deleteMutation = useDeleteLibraryItemsMutation(effectiveSpaceId);
  const restoreMutation = useBatchRestoreItemsMutation(effectiveSpaceId);
  const executeCommand = useLibraryCommandStore((s) => s.executeCommand);
  const clearCommandHistory = useLibraryCommandStore((s) => s.clearHistory);
  const clearSelection = useLibraryUIStore((s) => s.clearSelection);

  const handleEmptyTrash = useCallback(() => {
    if (effectiveTrashCount === 0) {
      toast.info('Trash is already empty', { id: 'empty-trash' });
      return;
    }
    openModal('EMPTY_TRASH', {
      permanent: true,
      onConfirm: async () => {
        try {
          await emptyTrash();
          clearCommandHistory();
          clearSelection();
        } catch {
          toast.error('Failed to empty trash', { id: 'empty-trash-error' });
        }
      },
    });
  }, [effectiveTrashCount, openModal, emptyTrash, clearCommandHistory, clearSelection]);

  const handleDropToTrash = useCallback(
    async (ids: string[]) => {
      if (!ids.length) return;
      try {
        await executeCommand(
          createTrashCommand({
            itemIds: ids,
            deleteMutation: { mutateAsync: deleteMutation.mutateAsync },
            restoreMutation: { mutateAsync: restoreMutation.mutateAsync },
          }),
        );
        toast.success(`Moved ${ids.length} item(s) to trash`, { id: 'drop-to-trash' });
      } catch {
        toast.error('Failed to move items to trash', { id: 'drop-to-trash-error' });
      }
    },
    [deleteMutation, executeCommand, restoreMutation],
  );

  const handleDropToMyPublications = useDropToMyPublications(effectiveSpaceId);

  const handleEditSavedSearch = (ss: SavedSearch) => {
    openModal('SAVED_SEARCH', { savedSearch: ss });
  };

  const handleDuplicateSavedSearch = async (ss: SavedSearch) => {
    const isProjectSearch =
      Boolean(ss.projectId) ||
      (isInProjectContext && ss.spaceId === projectId);
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
    () => (isInProjectContext ? projectCollections : userCollections),
    [isInProjectContext, projectCollections, userCollections],
  );

  const handleBatchMoveItems = useCallback(
    async (
      ids: string[],
      targetCollectionId: string | null,
      options?: { copy?: boolean; move?: boolean },
    ) => {
      if (!ids.length) return;
      let targetSpaceId = effectiveSpaceId;
      if (targetCollectionId) {
        const isUserCol = userCollections.some((c) => c.id === targetCollectionId);
        const isProjCol = projectCollections.some((c) => c.id === targetCollectionId);
        if (isUserCol) {
          targetSpaceId = 'user';
        } else if (isProjCol && projectId) {
          targetSpaceId = projectId;
        }
      }

      const targetCollection =
        userCollections.find((c) => c.id === targetCollectionId) ??
        projectCollections.find((c) => c.id === targetCollectionId);
      const targetCollectionName = targetCollection?.name ?? 'Unfiled Items';

      // Zotero Drag & Drop Semantics:
      // - When dragging from root "My Library" / Smart View (!activeId) into a collection,
      //   default to Add to Collection (preserving existing collections) unless Shift/Cmd explicitly requests Move.
      // - When holding Alt/Ctrl (`options?.copy`), always Add to Collection.
      const shouldCopyToCollection =
        Boolean(targetCollectionId) &&
        (Boolean(options?.copy) || (!activeId && !options?.move));

      if (shouldCopyToCollection && targetCollectionId) {
        const toastId = toast.loading(`Adding ${ids.length} item(s) to "${targetCollectionName}"...`, {
          id: 'batch-move',
        });
        try {
          await executeCommand(
            createBatchAssignCommand({
              collectionId: targetCollectionId,
              collectionName: targetCollectionName,
              itemIds: ids,
              assignMutation,
              detachMutation,
            }),
            { silentToast: true },
          );
          toast.success(`Added to "${targetCollectionName}"`, {
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
        await executeCommand(
          createMoveItemsCommand({
            itemIds: ids,
            sourceCollectionId: activeId || null,
            targetCollectionId,
            targetCollectionName,
            moveMutation,
            detachMutation,
            assignMutation,
            spaceId: targetSpaceId,
          }),
          { silentToast: true },
        );
        toast.success('Documents moved', {
          description: `Moved ${ids.length} item(s) to ${targetCollectionName}.`,
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
    [
      activeId,
      assignMutation,
      detachMutation,
      effectiveSpaceId,
      executeCommand,
      moveMutation,
      projectCollections,
      projectId,
      userCollections,
    ],
  );

  const userTree = useMemo(
    () => buildCollectionTree(filterCollections(userCollections, searchQuery)),
    [userCollections, searchQuery],
  );

  const projectTree = useMemo(
    () => buildCollectionTree(filterCollections(projectCollections, searchQuery)),
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
    effectiveSpaceId,
    collections,
    allCollectionsByScope,
    activeCollectionId: activeId,
  });

  const [isMounted, setIsMounted] = useState(false);
  const isMobile = useIsMobile();
  const [isRootDragOver, setIsRootDragOver] = useState(false);

  const handleRootDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/json') || e.dataTransfer.types.includes('text/plain')) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      setIsRootDragOver(true);
    }
  }, []);

  const handleRootDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsRootDragOver(false);
  }, []);

  const handleRootDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsRootDragOver(false);
    try {
      const raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
      if (raw) {
        const parsed = JSON.parse(raw) as string[] | { ids?: string[] };
        const ids = Array.isArray(parsed) ? parsed : (parsed?.ids || []);
        if (ids.length > 0) {
          void handleBatchMoveItems(ids, null);
        }
      }
    } catch {
      // Ignore parse error
    }
  }, [handleBatchMoveItems]);

  useEffect(() => {
    setIsMounted(true);
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
              {/* 1. Root Library Section (My Library in Personal Space, Project Library in Project Space) */}
              <div className="relative group/root flex items-center w-full">
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <Link
                      href={basePath}
                      onClick={() => {
                        handleMobileLinkClick();
                      }}
                      onDragOver={handleRootDragOver}
                      onDragLeave={handleRootDragLeave}
                      onDrop={handleRootDrop}
                      className={cn(
                        "group/item relative flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-13 leading-5 transition-colors outline-none select-none pr-8",
                        isLibraryActive
                          ? "bg-muted text-foreground font-medium"
                          : "text-foreground hover:bg-muted group-hover/root:bg-muted font-normal",
                        isRootDragOver && "bg-primary/10 text-primary font-medium ring-1 ring-primary ring-inset"
                      )}
                    >
                      <Library
                        className="relative z-10 size-4 shrink-0 text-foreground"
                        strokeWidth={1.5}
                      />
                      <span
                        suppressHydrationWarning
                        className={cn(
                          "relative z-10 min-w-0 truncate flex-1 tracking-tight text-foreground",
                          isLibraryActive ? "font-medium" : "font-normal"
                        )}
                      >
                        {isInProjectContext ? (activeSpace.projectName || 'Project Library') : 'My Library'}
                      </span>
                    </Link>
                  </ContextMenuTrigger>
                  <ContextMenuContent
                    collisionPadding={12}
                    className="w-56 p-1.5 rounded-md border border-border bg-popover text-popover-foreground z-50 shadow-raised-200 select-none space-y-0.5"
                  >
                    {canManageCollections && (
                      <>
                        <ContextMenuItem
                          onClick={handlers.openCreateRoot}
                          className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
                        >
                          <FolderPlus className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                          <span>New Collection...</span>
                        </ContextMenuItem>

                        <ContextMenuItem
                          onClick={() => openModal('SAVED_SEARCH')}
                          className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
                        >
                          <SlidersHorizontal className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                          <span>New Saved Search...</span>
                        </ContextMenuItem>

                        <ContextMenuSeparator className="my-1" />
                      </>
                    )}

                    <ContextMenuSub>
                      <ContextMenuSubTrigger className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors">
                        <Download className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                        <span>Export Library...</span>
                      </ContextMenuSubTrigger>
                      <ContextMenuSubContent
                        collisionPadding={16}
                        sideOffset={4}
                        alignOffset={-4}
                        className="w-48 p-1.5 rounded-md border border-border bg-popover text-popover-foreground text-13 shadow-raised-200 space-y-0.5 select-none"
                      >
                        {(
                          [
                            { format: 'bibtex' as const, label: 'BibTeX (.bib)' },
                            { format: 'ris' as const, label: 'RIS (.ris)' },
                            { format: 'csl_json' as const, label: 'CSL-JSON (.json)' },
                            { format: 'csv' as const, label: 'CSV (.csv)' },
                            { format: 'markdown' as const, label: 'Markdown (.md)' },
                          ]
                        ).map(({ format, label }) => (
                          <ContextMenuItem
                            key={format}
                            onClick={() =>
                              void executeExportScopeFormat(
                                effectiveSpaceId || 'user',
                                format,
                              )
                            }
                            className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
                          >
                            <span>{label}</span>
                          </ContextMenuItem>
                        ))}
                      </ContextMenuSubContent>
                    </ContextMenuSub>
                  </ContextMenuContent>
                </ContextMenu>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsLibraryExpanded((v) => !v);
                      }}
                      aria-label={isLibraryExpanded ? 'Collapse Library' : 'Expand Library'}
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

              {/* Sub-items directly nested under Active Space Library */}
              {isLibraryExpanded && (
                <div className="flex flex-col gap-0.5 w-full">
                  <SidebarSystemNav
                    basePath={basePath}
                    pathname={pathname}
                    currentFilter={currentFilter}
                    isUserScope={!isInProjectContext}
                    navId={id}
                    savedSearches={isInProjectContext ? projectSavedSearches : userSavedSearches}
                    currentSavedSearchId={currentSavedSearchId}
                    currentFeedId={currentFeedId}
                    onDropItems={handleBatchMoveItems}
                    onSelectUserScope={() => {
                      handleMobileLinkClick();
                    }}
                    onDeleteSavedSearch={handleDeleteSavedSearch}
                    onEditSavedSearch={handleEditSavedSearch}
                    onStartRenameSavedSearch={handleStartRenameSavedSearch}
                    onSubmitRenameSavedSearch={handleSubmitRenameSavedSearch}
                    onRenameSavedSearchValueChange={setRenameSavedSearchValue}
                    onDuplicateSavedSearch={handleDuplicateSavedSearch}
                    onEmptyTrash={handleEmptyTrash}
                    trashCount={effectiveTrashCount}
                    canEmptyTrash={canManageCollections}
                    onDropToTrash={handleDropToTrash}
                    onDropToMyPublications={handleDropToMyPublications}
                    renamingSavedSearchId={renamingSavedSearchId}
                    renameSavedSearchValue={renameSavedSearchValue}
                  >
                    {/* Active Space Collections Tree */}
                    <CollectionTree
                      tree={isInProjectContext ? projectTree : userTree}
                      allCollections={isInProjectContext ? projectCollections : userCollections}
                      basePath={basePath}
                      activeId={activeId ?? null}
                      navId={id}
                      renamingId={rename.renamingId}
                      renameValue={rename.renameValue}
                      isSearching={searchQuery.trim().length > 0}
                      searchQuery={searchQuery}
                      canManageCollections={canManageCollections}
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

export default LibrarySidebar;



