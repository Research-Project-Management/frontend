'use client';

import { useId, useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { motion, LayoutGroup } from 'framer-motion';
import { Library, ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { cn } from "@/shared/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui";
import {
  useCollections,
  useItems,
  useLibraryCountsQuery,
  useDuplicateGroups,
  useRetraction,
  useSavedSearches,
} from '../../data';
import { useLibrarySidebarStore, useLibraryPermissions } from '../../store';
import { useProjects } from '@/features/projects/shell/hooks/use-project';
import { useAuth } from '@/features/auth/hooks/use-auth';

import { CreateCollectionModal, TrashModal } from '../modals';
import type { SavedSearch } from '../../types/saved-searches.types';

import { buildTree, filterCollections } from './tree-helpers';
import { useSidebarResize } from './useSidebarResize';
import { useCollectionActions } from './useCollectionActions';
import { SidebarHeader } from './SidebarHeader';
import { SidebarResizer } from './SidebarResizer';
import { CollectionTree } from './CollectionTree';
import { SidebarSystemNav } from './SidebarSystemNav';
import { ProjectLibrariesSection, resolveProjectRole } from './ProjectLibrariesSection';

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

  const activeScope = useLibrarySidebarStore((s) => s.activeScope);
  const setActiveScope = useLibrarySidebarStore((s) => s.setActiveScope);
  const isOpen = useLibrarySidebarStore((s) => s.isOpen);
  const setIsOpen = useLibrarySidebarStore((s) => s.setIsOpen);
  const width = useLibrarySidebarStore((s) => s.width);
  const setWidth = useLibrarySidebarStore((s) => s.setWidth);
  const toggle = useLibrarySidebarStore((s) => s.toggle);
  const openModal = useLibrarySidebarStore((s) => s.openModal);
  const effectiveScopeId = activeScope.type === 'project' ? activeScope.id : 'user';

  const userCollectionService = useCollections('user');
  const projectCollectionService = useCollections(
    activeScope.type === 'project' ? activeScope.id : undefined,
  );
  const collectionService =
    activeScope.type === 'project' ? projectCollectionService : userCollectionService;

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsOpen(false);
    }
  }, [setIsOpen]);

  const [isLibraryExpanded, setIsLibraryExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [renamingSavedSearchId, setRenamingSavedSearchId] = useState<string | null>(null);
  const [renameSavedSearchValue, setRenameSavedSearchValue] = useState('');

  const { isDragging, handleMouseDown } = useSidebarResize(width, setWidth);

  const basePath = '/library';
  const currentFilter = searchParams.get('filter');
  const currentSavedSearchId = searchParams.get('savedSearchId');

  const { projects } = useProjects();
  const { user } = useAuth();
  const currentUserId = user?.id;

  const isUserScope = activeScope.type === 'user';
  const isLibraryActive = isUserScope && pathname === basePath && !currentFilter && !activeId;

  const { canManageCollections } = useLibraryPermissions();

  // Synchronize active project role with server-provided project list
  useEffect(() => {
    if (activeScope.type === 'project' && currentUserId && projects && projects.length > 0) {
      const currentProject = projects.find((p: any) => p.id === activeScope.id);
      if (currentProject) {
        const accurateRole = resolveProjectRole(currentProject, currentUserId);
        if (accurateRole !== activeScope.role) {
          setActiveScope({
            ...activeScope,
            role: accurateRole,
          });
        }
      }
    }
  }, [activeScope, currentUserId, projects, setActiveScope]);

  const { stats: retractionStats } = useRetraction(effectiveScopeId);
  const {
    savedSearches,
    createSavedSearch,
    updateSavedSearch,
    deleteSavedSearch,
  } = useSavedSearches(effectiveScopeId);

  const handleEditSavedSearch = (ss: SavedSearch) => {
    openModal('CREATE_SAVED_SEARCH', { savedSearch: ss });
  };

  const handleDuplicateSavedSearch = async (ss: SavedSearch) => {
    await createSavedSearch({
      name: `${ss.name} (Copy)`,
      conjunction: ss.conjunction || 'AND',
      conditions: ss.conditions,
    });
  };

  const handleStartRenameSavedSearch = (id: string, name: string) => {
    setRenamingSavedSearchId(id);
    setRenameSavedSearchValue(name);
  };

  const handleSubmitRenameSavedSearch = async (id: string) => {
    if (id !== '__cancel__') {
      const trimmed = renameSavedSearchValue.trim();
      if (trimmed) {
        await updateSavedSearch({
          id,
          data: { name: trimmed },
        });
      }
    }
    setRenamingSavedSearchId(null);
    setRenameSavedSearchValue('');
  };
  const { actions: itemActions } = useItems({ scopeId: effectiveScopeId, enabled: false });
  const { data: countsData } = useLibraryCountsQuery(effectiveScopeId);
  const { data: duplicateData } = useDuplicateGroups(effectiveScopeId);

  const unfiledCount = countsData?.unfiled ?? 0;
  const starredCount = countsData?.starred ?? 0;
  const duplicateCount = useMemo(() => {
    if (!duplicateData) return 0;
    if (Array.isArray(duplicateData)) return duplicateData.length;
    if (typeof duplicateData === 'object') {
      const obj = duplicateData as Record<string, unknown>;
      if (Array.isArray(obj.groups)) return obj.groups.length;
      if (Array.isArray(obj.duplicateGroups)) return obj.duplicateGroups.length;
    }
    return 0;
  }, [duplicateData]);

  const systemStats = useMemo(
    () => ({
      unfiledCount,
      starredCount,
      duplicateCount,
      retractedCount: retractionStats?.retractedCount,
    }),
    [unfiledCount, starredCount, duplicateCount, retractionStats?.retractedCount],
  );

  const userCollections = useMemo(
    () => userCollectionService.state.collections ?? [],
    [userCollectionService.state.collections],
  );

  const projectCollections = useMemo(
    () => (activeScope.type === 'project' ? projectCollectionService.state.collections ?? [] : []),
    [activeScope.type, projectCollectionService.state.collections],
  );

  const collections = useMemo(
    () => (activeScope.type === 'project' ? projectCollections : userCollections),
    [activeScope.type, projectCollections, userCollections],
  );

  const userTree = useMemo(
    () => buildTree(filterCollections(userCollections, searchQuery)),
    [userCollections, searchQuery],
  );

  const projectTree = useMemo(
    () => buildTree(filterCollections(projectCollections, searchQuery)),
    [projectCollections, searchQuery],
  );

  const { modals, rename, handlers } = useCollectionActions({
    collectionService,
    effectiveScopeId,
    collections,
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
      setIsOpen(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  const sidebarBody = (
    <>
      {/* Upper Area: Header, Collections Tree, Views */}
      <div className="flex-1 min-h-0 flex flex-col p-2.5 pt-4 pb-1">
          {/* Header with expandable search & controls */}
          <SidebarHeader
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            canManageCollections={canManageCollections}
            onOpenCreateRoot={handlers.openCreateRoot}
            onOpenCreateSavedSearch={() => openModal('CREATE_SAVED_SEARCH')}
            onToggleCollapse={toggle}
          />

          {/* Navigation Links */}
          <LayoutGroup id={`library-nav-${id}`}>
            <nav
              aria-label="Library Navigation"
              className="flex-1 overflow-x-hidden overflow-y-auto flex flex-col gap-1 sidebar-scrollbar scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
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
                  {isLibraryActive && (
                    <motion.div
                      layoutId={`library-nav-active-${id}`}
                      className="absolute inset-0 rounded-md bg-muted"
                      initial={false}
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
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

                <Tooltip delayDuration={700}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsLibraryExpanded((v) => !v);
                      }}
                      aria-label={isLibraryExpanded ? 'Collapse My Library' : 'Expand My Library'}
                      className="absolute right-2 z-20 flex size-6 shrink-0 items-center justify-center rounded-md text-foreground hover:bg-foreground/10 active:bg-foreground/20 cursor-pointer transition-colors duration-150 outline-none focus-visible:ring-1 focus-visible:ring-primary"
                    >
                      <ChevronRight
                        className={cn(
                          'size-3.5 text-foreground transition-transform duration-150 shrink-0',
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
                    className="text-11 font-normal px-2 py-0.5 rounded-md border border-border bg-popover text-foreground shadow-md"
                  >
                    {isLibraryExpanded ? 'Collapse' : 'Expand'}
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Sub-items directly nested under My Library */}
              {isLibraryExpanded && (
                <div className="flex flex-col gap-1 w-full">
                  <SidebarSystemNav
                    basePath={basePath}
                    pathname={pathname}
                    currentFilter={currentFilter}
                    isUserScope={isUserScope}
                    navId={id}
                    savedSearches={savedSearches}
                    currentSavedSearchId={currentSavedSearchId}
                    stats={systemStats}
                    retractedCount={retractionStats?.retractedCount}
                    onDropItems={(ids, targetColId) => itemActions.batchMoveItems(ids, targetColId)}
                    onSelectUserScope={() => {
                      setActiveScope({
                        type: 'user',
                        id: 'user',
                        name: 'Library',
                        role: 'owner',
                      });
                      handleMobileLinkClick();
                    }}
                    onDeleteSavedSearch={(id) => deleteSavedSearch(id)}
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
                      onDropItems={(ids, targetColId) => itemActions.batchMoveItems(ids, targetColId)}
                    />
                  </SidebarSystemNav>
                </div>
              )}

              {/* 2. Project Libraries (Collaborative Research Groups) */}
              <ProjectLibrariesSection
                projects={projects}
                activeScope={activeScope}
                currentUserId={currentUserId}
                basePath={basePath}
                navId={id}
                projectTree={projectTree}
                projectCollections={projectCollections}
                savedSearches={savedSearches}
                currentSavedSearchId={currentSavedSearchId}
                currentFilter={currentFilter}
                activeId={activeId ?? null}
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
                onDropItems={(ids, targetColId) => itemActions.batchMoveItems(ids, targetColId)}
                onEditSavedSearch={handleEditSavedSearch}
                onStartRenameSavedSearch={handleStartRenameSavedSearch}
                onSubmitRenameSavedSearch={handleSubmitRenameSavedSearch}
                onRenameSavedSearchValueChange={setRenameSavedSearchValue}
                onDuplicateSavedSearch={handleDuplicateSavedSearch}
                onDeleteSavedSearch={(id) => deleteSavedSearch(id)}
                renamingSavedSearchId={renamingSavedSearchId}
                renameSavedSearchValue={renameSavedSearchValue}
              />
            </nav>
          </LayoutGroup>
        </div>

        {/* Drag Handle for Resizing */}
        <SidebarResizer
          width={width}
          setWidth={setWidth}
          isDragging={isDragging}
          onMouseDown={handleMouseDown}
        />

        {/* Modals */}
        <CreateCollectionModal
          open={modals.createOpen}
          onOpenChange={(v: boolean) => {
            modals.setCreateOpen(v);
            if (!v) {
              modals.setCreateParentId(null);
            }
          }}
          onSubmit={handlers.handleCreate}
          isPending={collectionService.state.isCreating}
          collections={collections}
          defaultParentId={modals.createParentId}
        />

        <TrashModal
          open={modals.isTrashOpen}
          onOpenChange={modals.setIsTrashOpen}
          target={modals.trashTarget}
          onConfirm={handlers.handleConfirmTrash}
          isPending={collectionService.state.isDeleting}
        />
      </>
    );

    const mobileDrawer =
      isMobile && isMounted && typeof document !== 'undefined'
        ? createPortal(
            <div className="md:hidden">
              {/* Mobile Backdrop Overlay */}
              <div
                className="fixed inset-0 z-40 bg-black/30"
                onClick={() => setIsOpen(false)}
                aria-hidden="true"
              />
              <aside
                aria-label="Library navigation and collections"
                style={{
                  width: `${width}px`,
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
              width: `${width}px`,
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
